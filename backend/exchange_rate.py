"""Tasa de cambio oficial del BCV (bolívares por 1 USD): consulta, actualización y tarea automática."""
import asyncio
import json
import logging
import re
import ssl
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

import models
from common import get_settings
from database import SessionLocal

logger = logging.getLogger("inventario.tasa")

# Fuente principal: API pública que republica la tasa oficial del BCV (JSON, certificado válido)
# y trae la fecha en que esa tasa está vigente.
DOLARAPI_URL = "https://ve.dolarapi.com/v1/dolares/oficial"
DOLARAPI_SOURCE = "BCV oficial (vía DolarApi.com)"
# Respaldo: la página del propio BCV. Ojo: su certificado SSL está mal configurado, así que si la
# verificación falla se consulta sin verificar y, por precaución, se descartan valores que se vean erróneos.
BCV_URL = "https://www.bcv.org.ve/"
BCV_SOURCE = "BCV (bcv.org.ve)"

TIMEOUT_SECONDS = 8
USER_AGENT = "Mozilla/5.0 (compatible; InventarioApp/2.0)"
CARACAS = ZoneInfo("America/Caracas")
FOUR_DECIMALS = Decimal("0.0001")

UNAVAILABLE_MESSAGE = (
    "No se pudo consultar la tasa oficial del BCV. Revisa la conexión a internet del equipo; "
    "mientras tanto se mantiene la última tasa guardada."
)


class RateError(Exception):
    """No se pudo obtener o interpretar la tasa."""


@dataclass
class RateResult:
    rate: Decimal
    value_date: date | None  # Fecha valor: día a partir del cual rige la tasa
    source: str


# ---------- Lectura de las fuentes (funciones puras, fáciles de probar) ----------

def _to_rate(value) -> Decimal:
    try:
        rate = Decimal(str(value)).quantize(FOUR_DECIMALS)
    except (InvalidOperation, ValueError):
        raise RateError(f"valor no numérico: {value!r}")
    if not Decimal("0") < rate < Decimal("100000000"):
        raise RateError(f"valor fuera de rango: {rate}")
    return rate


def parse_dolarapi(payload) -> RateResult:
    if not isinstance(payload, dict) or payload.get("promedio") is None:
        raise RateError("respuesta inesperada")
    value_date = None
    stamp = payload.get("fechaActualizacion")
    if stamp:
        try:
            moment = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
            value_date = (moment.astimezone(CARACAS) if moment.tzinfo else moment).date()
        except ValueError:
            pass  # La fecha es informativa: sin ella igual se puede usar la tasa
    return RateResult(_to_rate(payload["promedio"]), value_date, DOLARAPI_SOURCE)


def parse_bcv(html: str) -> RateResult:
    start = html.find('id="dolar"')
    if start < 0:
        raise RateError("no se encontró la tasa del dólar en la página")
    block = html[start:start + 2500]
    amount = re.search(r"<strong[^>]*>\s*([\d.,]+)\s*</strong>", block)
    if not amount:
        raise RateError("no se encontró el monto en la página")
    text = amount.group(1)
    if "," in text:  # Formato venezolano: 1.234,56789000
        text = text.replace(".", "").replace(",", ".")
    value_date = None
    stamp = re.search(r"Fecha\s+Valor.*?content=\"(\d{4}-\d{2}-\d{2})", block, re.S)
    if stamp:
        value_date = date.fromisoformat(stamp.group(1))
    return RateResult(_to_rate(text), value_date, BCV_SOURCE)


# ---------- Consulta por internet ----------

def _get(url: str, verify: bool = True) -> str:
    context = None
    if not verify:
        context = ssl.create_default_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS, context=context) as response:
        return response.read().decode("utf-8", errors="replace")


def _get_bcv_html() -> str:
    try:
        return _get(BCV_URL)
    except urllib.error.URLError as exc:
        if isinstance(exc.reason, ssl.SSLCertVerificationError):
            return _get(BCV_URL, verify=False)
        raise


def fetch_rate(previous: Decimal | None = None) -> RateResult:
    """Consulta la tasa vigente. Prueba DolarApi y, si falla, la página del BCV."""
    problems = []
    try:
        return parse_dolarapi(json.loads(_get(DOLARAPI_URL)))
    except (OSError, ValueError, RateError) as exc:
        problems.append(f"DolarApi: {exc}")

    try:
        result = parse_bcv(_get_bcv_html())
        # Esta fuente se consulta sin verificar el certificado: un valor muy distinto al anterior
        # probablemente es un error de lectura, no una tasa real.
        if previous and not (previous / 2 <= result.rate <= previous * 2):
            raise RateError(f"valor inesperado ({result.rate}) frente a la tasa anterior ({previous})")
        return result
    except (OSError, ValueError, RateError) as exc:
        problems.append(f"BCV: {exc}")

    logger.warning("No se pudo obtener la tasa: %s", "; ".join(problems))
    raise RateError(UNAVAILABLE_MESSAGE)


# ---------- Actualización de la configuración ----------

def refresh_exchange_rate(db: Session) -> models.Setting:
    """Consulta la tasa y la guarda. Si falla, conserva la anterior y registra el error."""
    settings = get_settings(db)
    try:
        result = fetch_rate(settings.exchange_rate)
    except RateError as exc:
        settings.exchange_rate_error = str(exc)
        db.commit()
        raise
    settings.exchange_rate = result.rate
    settings.exchange_rate_date = result.value_date
    settings.exchange_rate_source = result.source
    settings.exchange_rate_updated_at = datetime.now(timezone.utc)
    settings.exchange_rate_error = None
    db.commit()
    db.refresh(settings)
    return settings


def _refresh_if_automatic() -> None:
    with SessionLocal() as db:
        if get_settings(db).exchange_rate_mode != "bcv":
            return
        try:
            refresh_exchange_rate(db)
        except RateError:
            pass  # Ya quedó registrado en la configuración y en el log


async def rate_updater(interval_minutes: int) -> None:
    """Tarea de fondo: actualiza la tasa al iniciar y luego cada cierto tiempo (si el modo es automático)."""
    while True:
        try:
            await asyncio.to_thread(_refresh_if_automatic)
        except Exception:  # noqa: BLE001 - la tarea nunca debe detenerse por un error puntual
            logger.exception("Error inesperado al actualizar la tasa")
        await asyncio.sleep(interval_minutes * 60)

"""Funciones de apoyo usadas por varios módulos."""
import unicodedata
from datetime import date, datetime, time, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models

CENT = Decimal("0.01")


def money(value) -> Decimal:
    """Redondea un monto a 2 decimales (redondeo comercial)."""
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def get_settings(db: Session) -> models.Setting:
    """Devuelve la configuración del negocio, creándola la primera vez."""
    settings = db.get(models.Setting, 1)
    if settings is None:
        settings = models.Setting(id=1, payment_methods=list(models.DEFAULT_PAYMENT_METHODS))
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def get_zone(tz: str) -> ZoneInfo:
    """Zona horaria del navegador (ej. 'America/Caracas') para agrupar por día local."""
    try:
        return ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(status_code=400, detail=f"Zona horaria no válida: {tz}")


def date_range(date_from: date, date_to: date, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """Convierte un rango de días locales en [inicio, fin) con hora y zona horaria."""
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="La fecha inicial no puede ser mayor que la final.")
    start = datetime.combine(date_from, time.min, tzinfo=zone)
    end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=zone)
    return start, end


def days_between(date_from: date, date_to: date) -> list[date]:
    return [date_from + timedelta(days=i) for i in range((date_to - date_from).days + 1)]


# ---------- Búsqueda sin distinguir mayúsculas ni acentos ("maria" encuentra "María") ----------
_ACCENTED = "áéíóúüàèìòùâêîôûäëïöñ"
_PLAIN = "aeiouuaeiouaeiouaeion"


def _fold_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.strip().lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def search_filter(text: str, *columns):
    """Condición SQL: alguna de las columnas contiene el texto buscado."""
    term = _fold_text(text).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{term}%"
    return or_(*(func.translate(func.lower(column), _ACCENTED, _PLAIN).like(pattern) for column in columns))

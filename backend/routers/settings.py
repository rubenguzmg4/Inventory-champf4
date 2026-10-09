from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session, undefer

import auth
import config
import models
import schemas
from common import get_settings
from database import get_db

router = APIRouter(prefix="/settings", tags=["Configuración"])


def _detect_image_type(data: bytes) -> str | None:
    """Identifica el formato por su contenido (no confiamos en el nombre del archivo)."""
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.get("/public", response_model=schemas.PublicSettings)
def public_settings(db: Session = Depends(get_db)):
    """Nombre, colores y logo del negocio. No requiere sesión (se usa en el login)."""
    return get_settings(db)


@router.get("", response_model=schemas.SettingsResponse)
def read_settings(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    return get_settings(db)


@router.put("", response_model=schemas.SettingsResponse)
def update_settings(
    data: schemas.SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    settings = get_settings(db)
    changes = data.model_dump(exclude_unset=True)
    # Estos campos no pueden quedar vacíos
    for field in ("business_name", "currency_symbol", "tax_name", "tax_rate", "secondary_currency_symbol",
                  "payment_methods", "receipt_format", "reorder_cover_days", "primary_color",
                  "color_scheme", "radius"):
        if field in changes and changes[field] is None:
            changes.pop(field)
    for key, value in changes.items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/logo")
def get_logo(db: Session = Depends(get_db)):
    """Imagen del logo del negocio (pública, para mostrarla en el login y facturas)."""
    settings = db.query(models.Setting).options(undefer(models.Setting.logo)).filter_by(id=1).first()
    if not settings or not settings.logo:
        raise HTTPException(status_code=404, detail="No hay logo configurado.")
    return Response(
        content=settings.logo,
        media_type=settings.logo_mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.put("/logo", response_model=schemas.SettingsResponse)
async def upload_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    data = await file.read(config.MAX_LOGO_BYTES + 1)
    if len(data) > config.MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="El logo no puede pesar más de 2 MB.")
    mime = _detect_image_type(data)
    if mime is None:
        raise HTTPException(status_code=400, detail="Formato no soportado. Usa una imagen PNG, JPG, WEBP o GIF.")

    settings = get_settings(db)
    settings.logo = data
    settings.logo_mime = mime
    settings.logo_updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(settings)
    return settings


@router.delete("/logo", status_code=status.HTTP_204_NO_CONTENT)
def delete_logo(db: Session = Depends(get_db), current_user: models.User = Depends(auth.require_admin)):
    settings = get_settings(db)
    settings.logo = None
    settings.logo_mime = None
    settings.logo_updated_at = None
    db.commit()

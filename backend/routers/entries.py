from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

import auth
import models
import schemas
from common import date_range, get_zone
from database import get_db

router = APIRouter(prefix="/entries", tags=["Entradas de mercancía"])


@router.get("", response_model=List[schemas.EntryResponse])
def list_entries(
    product_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    tz: str = "UTC",
    limit: int = Query(300, ge=1, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Entry).options(joinedload(models.Entry.product), joinedload(models.Entry.user))
    if product_id:
        query = query.filter(models.Entry.product_id == product_id)
    if date_from and date_to:
        start, end = date_range(date_from, date_to, get_zone(tz))
        query = query.filter(models.Entry.date >= start, models.Entry.date < end)
    return query.order_by(models.Entry.date.desc(), models.Entry.entry_id.desc()).limit(limit).all()


@router.post("", response_model=schemas.EntryResponse, status_code=status.HTTP_201_CREATED)
def add_stock_entry(
    entry_data: schemas.EntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Registra mercancía que llegó y suma el stock del producto."""
    product = (
        db.query(models.Product)
        .filter(models.Product.product_id == entry_data.product_id)
        .with_for_update()  # Evita que dos operaciones simultáneas pisen el stock
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    # Suma de stock automática en el inventario
    product.stock += entry_data.quantity
    # Si se indicó el costo, pasa a ser el costo actual del producto
    if entry_data.unit_cost is not None:
        product.cost = entry_data.unit_cost

    new_entry = models.Entry(**entry_data.model_dump(), user_id=current_user.user_id)
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry

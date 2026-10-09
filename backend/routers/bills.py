from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

import auth
import models
import schemas
from common import date_range, get_settings, get_zone, money, search_filter
from database import get_db

router = APIRouter(prefix="/bills", tags=["Facturación"])


def _get_or_404(db: Session, bill_id: int) -> models.Bill:
    bill = (
        db.query(models.Bill)
        .options(
            joinedload(models.Bill.client),
            joinedload(models.Bill.user),
            joinedload(models.Bill.voided_by),
            selectinload(models.Bill.details),
        )
        .filter(models.Bill.bill_id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Factura no encontrada.")
    return bill


def _lock_products(db: Session, product_ids) -> dict[int, models.Product]:
    """
    Bloquea las filas de los productos hasta terminar la transacción, para que dos
    cajas facturando al mismo tiempo no vendan más stock del que hay.
    Se bloquean en orden de ID para evitar bloqueos cruzados (deadlocks).
    """
    products = (
        db.query(models.Product)
        .filter(models.Product.product_id.in_(list(product_ids)))
        .order_by(models.Product.product_id)
        .with_for_update()
        .all()
    )
    return {p.product_id: p for p in products}


@router.post("", response_model=schemas.BillResponse, status_code=status.HTTP_201_CREATED)
def create_bill(
    bill_data: schemas.BillCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    # 1. Validar existencia del cliente
    client = db.get(models.Client, bill_data.client_id)
    if not client:
        raise HTTPException(status_code=404, detail="El cliente especificado no existe.")

    # 2. Agrupar productos repetidos (ej. el mismo producto escaneado dos veces)
    quantities: dict[int, int] = {}
    for item in bill_data.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products = _lock_products(db, quantities)

    # 3. Validar todo antes de modificar nada
    for product_id, quantity in quantities.items():
        product = products.get(product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Producto con ID {product_id} no encontrado.")
        if not product.is_active:
            raise HTTPException(status_code=400, detail=f"El producto '{product.name}' está desactivado.")
        if product.stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para '{product.name}'. Stock actual: {product.stock}, solicitado: {quantity}",
            )

    # 4. Descontar stock y armar las líneas de la factura
    subtotal = Decimal("0.00")
    details = []
    for product_id, quantity in quantities.items():
        product = products[product_id]
        product.stock -= quantity
        line_total = money(product.price * quantity)
        subtotal += line_total
        details.append(models.BillDetail(
            product_id=product_id,
            product_name=product.name,
            quantity=quantity,
            unit_price=product.price,
            unit_cost=product.cost,
            subtotal=line_total,
        ))

    # 5. Impuesto y total según la configuración del negocio
    settings = get_settings(db)
    tax_amount = money(subtotal * settings.tax_rate / 100)
    new_bill = models.Bill(
        client_id=client.client_id,
        user_id=current_user.user_id,
        payment_method=bill_data.payment_method,
        subtotal=subtotal,
        tax_rate=settings.tax_rate,
        tax_amount=tax_amount,
        total=subtotal + tax_amount,
        exchange_rate=settings.exchange_rate,
        note=bill_data.note,
        details=details,
    )
    db.add(new_bill)
    db.commit()  # Todo se guarda junto: si algo falla, no se guarda nada
    return _get_or_404(db, new_bill.bill_id)


@router.get("", response_model=List[schemas.BillSummary])
def list_bills(
    search: Optional[str] = Query(None, description="Número de factura, cédula o nombre del cliente"),
    client_id: Optional[str] = Query(None, description="Filtrar facturas por cédula del cliente"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    tz: str = "UTC",
    bill_status: Optional[Literal["paid", "void"]] = Query(None, alias="status"),
    limit: int = Query(300, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = (
        db.query(models.Bill)
        .join(models.Bill.client)
        .options(contains_eager(models.Bill.client), joinedload(models.Bill.user), selectinload(models.Bill.details))
    )
    if client_id:
        query = query.filter(models.Bill.client_id == client_id.strip().upper())
    if search:
        query = query.filter(or_(
            cast(models.Bill.bill_id, String) == search.strip().lstrip("#0"),
            search_filter(search, models.Client.client_id, models.Client.name + " " + models.Client.lastname),
        ))
    if date_from and date_to:
        start, end = date_range(date_from, date_to, get_zone(tz))
        query = query.filter(models.Bill.date >= start, models.Bill.date < end)
    if bill_status:
        query = query.filter(models.Bill.status == bill_status)
    return query.order_by(models.Bill.bill_id.desc()).limit(limit).all()


@router.get("/{bill_id}", response_model=schemas.BillResponse)
def get_bill_detail(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _get_or_404(db, bill_id)


@router.post("/{bill_id}/void", response_model=schemas.BillResponse)
def void_bill(
    bill_id: int,
    data: schemas.BillVoid,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Anula una factura y devuelve los productos al inventario."""
    bill = db.query(models.Bill).filter(models.Bill.bill_id == bill_id).with_for_update().first()
    if not bill:
        raise HTTPException(status_code=404, detail="Factura no encontrada.")
    if bill.status == "void":
        raise HTTPException(status_code=400, detail="La factura ya estaba anulada.")

    products = _lock_products(db, {d.product_id for d in bill.details})
    for detail in bill.details:
        products[detail.product_id].stock += detail.quantity

    bill.status = "void"
    bill.voided_at = datetime.now(timezone.utc)
    bill.voided_by_id = current_user.user_id
    bill.void_reason = data.reason
    db.commit()
    return _get_or_404(db, bill_id)

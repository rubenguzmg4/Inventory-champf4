import math
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

import auth
import models
import schemas
from common import get_settings, money, search_filter
from database import get_db

router = APIRouter(prefix="/products", tags=["Productos"])

# Días de ventas que se usan para calcular el promedio diario en la reposición
SALES_WINDOW_DAYS = 30


def _get_or_404(db: Session, product_id: int, lock: bool = False) -> models.Product:
    query = db.query(models.Product).filter(models.Product.product_id == product_id)
    if lock:
        query = query.with_for_update()
    product = query.first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return product


def _to_response(product: models.Product, user: models.User) -> schemas.ProductResponse:
    data = schemas.ProductResponse.model_validate(product)
    if user.role != "admin":
        data.cost = None  # Los cajeros no ven el costo de compra
    return data


def _check_code(db: Session, code: Optional[str], exclude_id: Optional[int] = None):
    if not code:
        return
    query = db.query(models.Product).filter(models.Product.code == code)
    if exclude_id is not None:
        query = query.filter(models.Product.product_id != exclude_id)
    if query.first():
        raise HTTPException(status_code=400, detail=f"Ya existe un producto con el código '{code}'.")


def _check_category(db: Session, category_id: int):
    if not db.get(models.Category, category_id):
        raise HTTPException(status_code=404, detail="La categoría especificada no existe.")


@router.get("", response_model=List[schemas.ProductResponse])
def list_products(
    search: Optional[str] = Query(None, description="Buscar por nombre o código"),
    category_id: Optional[int] = Query(None, description="Filtrar por ID de categoría"),
    stock_status: Optional[Literal["low", "out"]] = Query(None, description="'low' = bajo mínimo, 'out' = agotado"),
    include_inactive: bool = Query(False, description="Incluir productos desactivados"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Product).options(joinedload(models.Product.category))
    if not include_inactive:
        query = query.filter(models.Product.is_active.is_(True))
    if search:
        query = query.filter(search_filter(search, models.Product.name, models.Product.code))
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    if stock_status == "out":
        query = query.filter(models.Product.stock <= 0)
    elif stock_status == "low":
        query = query.filter(or_(models.Product.stock <= 0, models.Product.stock <= models.Product.min_stock))

    return [_to_response(p, current_user) for p in query.order_by(models.Product.name).all()]


@router.get("/replenishment", response_model=List[schemas.ReplenishmentItem])
def replenishment(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """
    Productos que hay que reponer y cuánto pedir.

    Sugerido = stock mínimo + (venta diaria promedio × días a cubrir) − stock actual.
    Si el producto no tuvo ventas recientes, se sugiere llegar al doble del stock mínimo.
    """
    cover_days = get_settings(db).reorder_cover_days
    since = datetime.now(timezone.utc) - timedelta(days=SALES_WINDOW_DAYS)
    sold = dict(
        db.query(models.BillDetail.product_id, func.sum(models.BillDetail.quantity))
        .join(models.Bill)
        .filter(models.Bill.status == "paid", models.Bill.date >= since)
        .group_by(models.BillDetail.product_id)
        .all()
    )

    products = (
        db.query(models.Product)
        .options(joinedload(models.Product.category))
        .filter(models.Product.is_active.is_(True))
        .all()
    )
    items = []
    for p in products:
        avg_daily = (sold.get(p.product_id) or 0) / SALES_WINDOW_DAYS
        days_left = p.stock / avg_daily if avg_daily > 0 else None

        if p.stock <= 0:
            status_ = "out"
        elif p.stock <= p.min_stock:
            status_ = "low"
        elif days_left is not None and days_left < cover_days:
            status_ = "soon"
        else:
            continue

        target = p.min_stock + math.ceil(avg_daily * cover_days)
        if avg_daily == 0:
            target = p.min_stock * 2
        suggested = max(target - max(p.stock, 0), 0)

        items.append(schemas.ReplenishmentItem(
            product_id=p.product_id,
            code=p.code,
            name=p.name,
            category_name=p.category_name,
            stock=p.stock,
            min_stock=p.min_stock,
            cost=p.cost,
            avg_daily_sales=round(avg_daily, 2),
            days_left=round(days_left, 1) if days_left is not None else None,
            suggested_quantity=suggested,
            estimated_cost=money(p.cost * suggested),
            status=status_,
        ))

    order = {"out": 0, "low": 1, "soon": 2}
    items.sort(key=lambda i: (order[i.status], i.days_left if i.days_left is not None else math.inf, i.name))
    if current_user.role != "admin":
        for item in items:
            item.cost = 0
            item.estimated_cost = 0
    return items


@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return _to_response(_get_or_404(db, product_id), current_user)


@router.post("", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    _check_category(db, product.category_id)
    _check_code(db, product.code)

    new_product = models.Product(**product.model_dump())
    db.add(new_product)
    db.flush()  # Genera el product_id

    # El stock inicial queda registrado como una entrada para tener trazabilidad
    if product.stock > 0:
        db.add(models.Entry(
            product_id=new_product.product_id,
            user_id=current_user.user_id,
            quantity=product.stock,
            unit_cost=product.cost or None,
            note="Stock inicial",
        ))
    db.commit()
    db.refresh(new_product)
    return new_product


@router.put("/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_data: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    product = _get_or_404(db, product_id)
    update_data = product_data.model_dump(exclude_unset=True)
    for field in ("name", "price", "cost", "min_stock", "category_id", "is_active"):
        if field in update_data and update_data[field] is None:
            update_data.pop(field)  # Estos campos no pueden quedar vacíos
    if "category_id" in update_data:
        _check_category(db, update_data["category_id"])
    if "code" in update_data:
        _check_code(db, update_data["code"], exclude_id=product_id)

    for key, value in update_data.items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", response_model=schemas.DeleteResult)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Si el producto ya se vendió alguna vez, se desactiva (para no perder el historial
    de facturas). Si nunca se vendió, se elimina junto con sus entradas y ajustes.
    """
    product = _get_or_404(db, product_id)
    if db.query(models.BillDetail).filter(models.BillDetail.product_id == product_id).first():
        product.is_active = False
        db.commit()
        return {"deleted": False, "detail": "El producto tiene ventas registradas, así que se desactivó en lugar de eliminarse."}

    db.query(models.Entry).filter(models.Entry.product_id == product_id).delete()
    db.query(models.StockAdjustment).filter(models.StockAdjustment.product_id == product_id).delete()
    db.delete(product)
    db.commit()
    return {"deleted": True, "detail": "Producto eliminado."}


@router.post("/{product_id}/adjust", response_model=schemas.ProductResponse)
def adjust_stock(
    product_id: int,
    data: schemas.StockAdjust,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Corrige el stock a mano (conteo físico, mercancía dañada, pérdida...)."""
    product = _get_or_404(db, product_id, lock=True)
    if product.stock == data.new_stock:
        raise HTTPException(status_code=400, detail="El stock nuevo es igual al actual.")

    db.add(models.StockAdjustment(
        product_id=product_id,
        user_id=current_user.user_id,
        previous_stock=product.stock,
        new_stock=data.new_stock,
        reason=data.reason,
    ))
    product.stock = data.new_stock
    db.commit()
    db.refresh(product)
    return product


@router.get("/{product_id}/movements", response_model=List[schemas.ProductMovement])
def product_movements(
    product_id: int,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Historial (kárdex) del producto: entradas, ventas, anulaciones y ajustes."""
    _get_or_404(db, product_id)
    movements = []

    entries = db.query(models.Entry).options(joinedload(models.Entry.user)).filter(models.Entry.product_id == product_id)
    for e in entries:
        reference = f"Entrada #{e.entry_id}" + (f" · {e.supplier}" if e.supplier else "") + (f" · {e.note}" if e.note else "")
        movements.append(dict(date=e.date, type="entrada", quantity=e.quantity, reference=reference, user_name=e.user_name))

    adjustments = (
        db.query(models.StockAdjustment)
        .options(joinedload(models.StockAdjustment.user))
        .filter(models.StockAdjustment.product_id == product_id)
    )
    for a in adjustments:
        movements.append(dict(
            date=a.date, type="ajuste", quantity=a.new_stock - a.previous_stock,
            reference=f"Ajuste: {a.reason}", user_name=a.user.display_name if a.user else None,
        ))

    sales = (
        db.query(models.BillDetail, models.Bill)
        .join(models.Bill)
        .options(joinedload(models.Bill.user), joinedload(models.Bill.voided_by))
        .filter(models.BillDetail.product_id == product_id)
    )
    for detail, bill in sales:
        movements.append(dict(
            date=bill.date, type="venta", quantity=-detail.quantity,
            reference=f"Factura #{bill.bill_id}", user_name=bill.cashier_name,
        ))
        if bill.status == "void":
            movements.append(dict(
                date=bill.voided_at, type="anulación", quantity=detail.quantity,
                reference=f"Anulación de factura #{bill.bill_id}", user_name=bill.voided_by_name,
            ))

    movements.sort(key=lambda m: m["date"], reverse=True)
    return movements[:limit]

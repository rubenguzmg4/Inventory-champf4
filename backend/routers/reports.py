from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, contains_eager, joinedload, selectinload

import auth
import models
import schemas
from common import date_range, days_between, get_zone
from database import get_db

router = APIRouter(prefix="/reports", tags=["Reportes"], dependencies=[Depends(auth.require_admin)])

Bill = models.Bill
Detail = models.BillDetail
Product = models.Product


def _paid_in(start: datetime, end: datetime):
    return [Bill.status == "paid", Bill.date >= start, Bill.date < end]


def _totals(db: Session, start: datetime, end: datetime) -> dict:
    total, count = (
        db.query(func.coalesce(func.sum(Bill.total), 0), func.count(Bill.bill_id))
        .filter(*_paid_in(start, end))
        .one()
    )
    return {"total": float(total), "count": count}


def _sales_by_day(db: Session, date_from: date, date_to: date, tz: str) -> list[dict]:
    """Ventas agrupadas por día local; los días sin ventas aparecen en cero."""
    start, end = date_range(date_from, date_to, get_zone(tz))
    # Se agrupa por la etiqueta "day" para que PostgreSQL reconozca la misma expresión
    local_day = func.date(func.timezone(tz, Bill.date)).label("day")
    rows = (
        db.query(local_day, func.sum(Bill.total), func.count(Bill.bill_id))
        .filter(*_paid_in(start, end))
        .group_by(local_day)
        .all()
    )
    found = {day: (float(total), count) for day, total, count in rows}
    return [
        {"date": day.isoformat(), "total": found.get(day, (0.0, 0))[0], "count": found.get(day, (0.0, 0))[1]}
        for day in days_between(date_from, date_to)
    ]


def _top_products(
    db: Session, start: datetime, end: datetime, limit: int, order_by: str = "revenue", category_id: int | None = None
) -> list[dict]:
    """Productos vendidos en el período, de mayor a menor por unidades ('units') o por ingresos ('revenue')."""
    cost = func.coalesce(Detail.unit_cost, 0)
    units = func.sum(Detail.quantity)
    revenue = func.sum(Detail.subtotal)
    query = (
        db.query(
            Detail.product_id,
            Product.name,
            Product.code,
            Product.brand,
            models.Category.name,
            units,
            revenue,
            func.sum(Detail.subtotal - Detail.quantity * cost),
        )
        .join(Bill, Detail.bill_id == Bill.bill_id)
        .join(Product, Detail.product_id == Product.product_id)
        .join(models.Category, Product.category_id == models.Category.category_id)
        .filter(*_paid_in(start, end))
    )
    if category_id:
        query = query.filter(Product.category_id == category_id)
    # El segundo criterio desempata: ante igual cantidad gana el que dejó más dinero (y viceversa)
    order = (units.desc(), revenue.desc()) if order_by == "units" else (revenue.desc(), units.desc())
    rows = (
        query.group_by(Detail.product_id, Product.name, Product.code, Product.brand, models.Category.name)
        .order_by(*order, Product.name)
        .limit(limit)
        .all()
    )
    return [
        {
            "product_id": pid, "name": name, "code": code, "brand": brand, "category": category,
            "quantity": int(qty), "total": float(total), "profit": float(profit),
        }
        for pid, name, code, brand, category, qty, total, profit in rows
    ]


@router.get("/dashboard")
def dashboard(tz: str = "UTC", db: Session = Depends(get_db)):
    """Resumen para la pantalla de inicio del administrador."""
    zone = get_zone(tz)
    today = datetime.now(zone).date()
    yesterday = today - timedelta(days=1)
    month_start = today.replace(day=1)
    # Mismo tramo del mes anterior (ej. del 1 al 7) para comparar
    prev_month_end = month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    prev_month_to = min(prev_month_start + (today - month_start), prev_month_end)

    low_stock = (
        db.query(func.count(Product.product_id))
        .filter(Product.is_active.is_(True), or_(Product.stock <= 0, Product.stock <= Product.min_stock))
        .scalar()
    )
    out_of_stock = (
        db.query(func.count(Product.product_id))
        .filter(Product.is_active.is_(True), Product.stock <= 0)
        .scalar()
    )
    recent = (
        db.query(Bill)
        .join(Bill.client)
        .options(contains_eager(Bill.client), joinedload(Bill.user), selectinload(Bill.details))
        .order_by(Bill.bill_id.desc())
        .limit(6)
        .all()
    )

    return {
        "today": _totals(db, *date_range(today, today, zone)),
        "yesterday": _totals(db, *date_range(yesterday, yesterday, zone)),
        "month": _totals(db, *date_range(month_start, today, zone)),
        "prev_month": _totals(db, *date_range(prev_month_start, prev_month_to, zone)),
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "sales_by_day": _sales_by_day(db, today - timedelta(days=29), today, tz),
        "top_products": _top_products(db, *date_range(month_start, today, zone), limit=5, order_by="units"),
        "recent_bills": [schemas.BillSummary.model_validate(b).model_dump(mode="json") for b in recent],
    }


@router.get("/sales")
def sales_report(date_from: date, date_to: date, tz: str = "UTC", db: Session = Depends(get_db)):
    """Reporte de ventas de un período: totales, por día, por forma de pago, cajero, categoría y producto."""
    if (date_to - date_from).days > 731:
        raise HTTPException(status_code=400, detail="El período no puede ser mayor a 2 años.")
    start, end = date_range(date_from, date_to, get_zone(tz))
    paid = _paid_in(start, end)

    total, subtotal, tax, count = (
        db.query(
            func.coalesce(func.sum(Bill.total), 0),
            func.coalesce(func.sum(Bill.subtotal), 0),
            func.coalesce(func.sum(Bill.tax_amount), 0),
            func.count(Bill.bill_id),
        )
        .filter(*paid)
        .one()
    )
    items_sold, cost_total = (
        db.query(
            func.coalesce(func.sum(Detail.quantity), 0),
            func.coalesce(func.sum(Detail.quantity * func.coalesce(Detail.unit_cost, 0)), 0),
        )
        .join(Bill, Detail.bill_id == Bill.bill_id)
        .filter(*paid)
        .one()
    )
    voided_count, voided_total = (
        db.query(func.count(Bill.bill_id), func.coalesce(func.sum(Bill.total), 0))
        .filter(Bill.status == "void", Bill.date >= start, Bill.date < end)
        .one()
    )

    by_payment = (
        db.query(Bill.payment_method, func.sum(Bill.total), func.count(Bill.bill_id))
        .filter(*paid)
        .group_by(Bill.payment_method)
        .order_by(func.sum(Bill.total).desc())
        .all()
    )
    by_cashier = (
        db.query(models.User, func.sum(Bill.total), func.count(Bill.bill_id))
        .join(Bill, Bill.user_id == models.User.user_id)
        .filter(*paid)
        .group_by(models.User.user_id)
        .order_by(func.sum(Bill.total).desc())
        .all()
    )
    by_category = (
        db.query(models.Category.name, func.sum(Detail.subtotal), func.sum(Detail.quantity))
        .select_from(Detail)
        .join(Bill, Detail.bill_id == Bill.bill_id)
        .join(Product, Detail.product_id == Product.product_id)
        .join(models.Category, Product.category_id == models.Category.category_id)
        .filter(*paid)
        .group_by(models.Category.name)
        .order_by(func.sum(Detail.subtotal).desc())
        .all()
    )

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "summary": {
            "total": float(total),
            "subtotal": float(subtotal),
            "tax": float(tax),
            "bills_count": count,
            "avg_ticket": float(total / count) if count else 0.0,
            "items_sold": int(items_sold),
            "cost_total": float(cost_total),
            "gross_profit": float(subtotal - cost_total),
            "voided_count": voided_count,
            "voided_total": float(voided_total),
        },
        "by_day": _sales_by_day(db, date_from, date_to, tz),
        "by_payment_method": [
            {"method": method, "total": float(t), "count": c} for method, t, c in by_payment
        ],
        "by_cashier": [
            {"user": user.display_name, "total": float(t), "count": c} for user, t, c in by_cashier
        ],
        "by_category": [
            {"category": name, "total": float(t), "quantity": int(q)} for name, t, q in by_category
        ],
    }


@router.get("/products")
def products_report(
    date_from: date,
    date_to: date,
    tz: str = "UTC",
    category_id: int | None = None,
    db: Session = Depends(get_db),
):
    """
    Productos vendidos en un período, con unidades, ingresos (sin impuesto) y ganancia. Con `category_id`
    solo los de esa categoría. Viene ordenado por ingresos; la pantalla lo reordena por unidades.
    """
    if (date_to - date_from).days > 731:
        raise HTTPException(status_code=400, detail="El período no puede ser mayor a 2 años.")
    category = None
    if category_id:
        category = db.get(models.Category, category_id)
        if not category:
            raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    start, end = date_range(date_from, date_to, get_zone(tz))
    return {
        "category": category.name if category else None,
        "items": _top_products(db, start, end, limit=500, order_by="revenue", category_id=category_id),
    }


@router.get("/inventory")
def inventory_report(db: Session = Depends(get_db)):
    """Inventario valorizado: cuánto vale lo que hay en el depósito (a costo y a precio de venta)."""
    products = (
        db.query(Product)
        .join(Product.category)
        .options(contains_eager(Product.category))
        .filter(Product.is_active.is_(True))
        .order_by(models.Category.name, Product.name)
        .all()
    )
    items = []
    totals = {"products": 0, "units": 0, "value_cost": 0.0, "value_price": 0.0}
    for p in products:
        stock = max(p.stock, 0)
        value_cost = float(p.cost * stock)
        value_price = float(p.price * stock)
        items.append({
            "product_id": p.product_id,
            "code": p.code,
            "name": p.name,
            "brand": p.brand,
            "category_name": p.category_name,
            "stock": p.stock,
            "min_stock": p.min_stock,
            "cost": float(p.cost),
            "price": float(p.price),
            "value_cost": value_cost,
            "value_price": value_price,
            "is_low_stock": p.is_low_stock,
        })
        totals["products"] += 1
        totals["units"] += stock
        totals["value_cost"] += value_cost
        totals["value_price"] += value_price
    totals["potential_profit"] = totals["value_price"] - totals["value_cost"]
    return {"items": items, "totals": totals}

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/categories", tags=["Categorías"])


def _get_or_404(db: Session, category_id: int) -> models.Category:
    category = db.get(models.Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada.")
    return category


def _name_taken(db: Session, name: str, exclude_id: int | None = None) -> bool:
    query = db.query(models.Category).filter(func.lower(models.Category.name) == name.lower())
    if exclude_id is not None:
        query = query.filter(models.Category.category_id != exclude_id)
    return query.first() is not None


@router.get("", response_model=List[schemas.CategoryResponse])
def list_categories(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Obtiene la lista de todas las categorías con su cantidad de productos activos."""
    rows = (
        db.query(models.Category, func.count(models.Product.product_id))
        .outerjoin(
            models.Product,
            (models.Product.category_id == models.Category.category_id) & models.Product.is_active.is_(True),
        )
        .group_by(models.Category.category_id)
        .order_by(models.Category.name)
        .all()
    )
    return [
        schemas.CategoryResponse(
            category_id=category.category_id,
            name=category.name,
            description=category.description,
            product_count=count,
        )
        for category, count in rows
    ]


@router.post("", response_model=schemas.CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Crea una nueva categoría de productos."""
    if _name_taken(db, category.name):
        raise HTTPException(status_code=400, detail="Ya existe una categoría con este nombre.")

    new_cat = models.Category(**category.model_dump())
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat


@router.put("/{category_id}", response_model=schemas.CategoryResponse)
def update_category(
    category_id: int,
    data: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    category = _get_or_404(db, category_id)
    if _name_taken(db, data.name, exclude_id=category_id):
        raise HTTPException(status_code=400, detail="Ya existe una categoría con este nombre.")
    category.name = data.name
    category.description = data.description
    db.commit()
    db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    category = _get_or_404(db, category_id)
    if db.query(models.Product).filter(models.Product.category_id == category_id).first():
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar: la categoría tiene productos. Muévelos a otra categoría primero.",
        )
    db.delete(category)
    db.commit()

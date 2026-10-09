from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import auth
import models
import schemas
from database import get_db

router = APIRouter(prefix="/users", tags=["Usuarios"], dependencies=[Depends(auth.require_admin)])


def _active_admins(db: Session) -> int:
    return db.query(models.User).filter(models.User.role == "admin", models.User.is_active.is_(True)).count()


@router.get("", response_model=List[schemas.UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.username).all()


@router.post("", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """Registra un nuevo usuario (cajero o administrador). Solo administradores."""
    if db.query(models.User).filter(models.User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="El nombre de usuario ya está registrado.")

    new_user = models.User(
        username=user_data.username,
        full_name=user_data.full_name,
        password_hash=auth.hash_password(user_data.password),
        role=user_data.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.put("/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    changes = data.model_dump(exclude_unset=True)
    loses_admin = (changes.get("role", user.role) != "admin" or changes.get("is_active", user.is_active) is False)
    if user.role == "admin" and user.is_active and loses_admin:
        if user.user_id == current_user.user_id:
            raise HTTPException(status_code=400, detail="No puedes quitarte el rol de administrador ni desactivarte a ti mismo.")
        if _active_admins(db) <= 1:
            raise HTTPException(status_code=400, detail="Debe quedar al menos un administrador activo.")

    password = changes.pop("password", None)
    if password:
        user.password_hash = auth.hash_password(password)
    for key, value in changes.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

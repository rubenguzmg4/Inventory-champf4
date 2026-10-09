from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

import auth
import models
import schemas
from common import get_settings
from database import get_db

router = APIRouter(tags=["Sesión"])

GENERIC_CLIENT_ID = "0"


@router.get("/setup")
def setup_status(db: Session = Depends(get_db)):
    """Indica si falta crear el primer administrador."""
    return {"needs_setup": db.query(models.User).count() == 0}


@router.post("/setup", response_model=schemas.LoginResponse, status_code=status.HTTP_201_CREATED)
def setup(data: schemas.SetupCreate, db: Session = Depends(get_db)):
    """Configuración inicial: crea el primer administrador. Solo funciona una vez."""
    if db.query(models.User).count() > 0:
        raise HTTPException(status_code=409, detail="El sistema ya fue configurado.")

    settings = get_settings(db)
    settings.business_name = data.business_name
    admin = models.User(
        username=data.username,
        full_name=data.full_name,
        password_hash=auth.hash_password(data.password),
        role="admin",
    )
    db.add(admin)
    # Cliente genérico para ventas rápidas sin datos del comprador
    if not db.get(models.Client, GENERIC_CLIENT_ID):
        db.add(models.Client(client_id=GENERIC_CLIENT_ID, name="Consumidor", lastname="Final"))
    db.commit()
    db.refresh(admin)
    return {"access_token": auth.create_access_token(admin), "user": admin}


@router.post("/login", response_model=schemas.LoginResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Inicia sesión y genera un Token JWT para autenticar peticiones."""
    user = db.query(models.User).filter(models.User.username == form_data.username.strip()).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Este usuario está desactivado.")

    return {"access_token": auth.create_access_token(user), "user": user}


@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_user)):
    """Devuelve la información del usuario que tiene la sesión activa."""
    return current_user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Permite a cada usuario cambiar su propia contraseña."""
    if not auth.verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    current_user.password_hash = auth.hash_password(data.new_password)
    db.commit()

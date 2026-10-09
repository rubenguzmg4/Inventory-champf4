import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import config
import models
from common import get_settings
from database import get_db

# Configuración de Seguridad
ALGORITHM = "HS256"
_secret_key = config.SECRET_KEY

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


def load_secret_key(db: Session):
    """Usa SECRET_KEY si está definida; si no, genera una y la guarda en la BD."""
    global _secret_key
    if _secret_key:
        return
    settings = get_settings(db)
    if not settings.secret_key:
        settings.secret_key = secrets.token_urlsafe(48)
        db.commit()
    _secret_key = settings.secret_key


# Funciones de Encriptación de Contraseñas
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


# Creación de Token JWT
def create_access_token(user: models.User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user.user_id), "exp": expire}, _secret_key, algorithm=ALGORITHM)


# Inyección de Dependencia para Proteger Rutas
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Tu sesión expiró o no es válida. Inicia sesión de nuevo.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, _secret_key, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (jwt.PyJWTError, TypeError, ValueError):
        raise credentials_exception

    user = db.get(models.User, user_id)
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    """Solo permite el paso a usuarios con rol de administrador."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta acción requiere permisos de administrador.",
        )
    return current_user

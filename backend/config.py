import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Permite definir las variables en un archivo backend/.env cuando se trabaja sin Docker
load_dotenv(BASE_DIR / ".env")

# Cadena de conexión: postgresql+psycopg2://usuario:contraseña@servidor:puerto/nombre_bd
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://inventory:inventory@localhost:5432/inventory_db",
)

# Clave para firmar los tokens de sesión. Si no se define, se genera una al azar
# la primera vez y se guarda en la base de datos.
SECRET_KEY = os.getenv("SECRET_KEY") or None

# El token expira en 8 horas (1 jornada laboral)
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

# Carpeta con la interfaz web ya compilada (la llena Docker al construir la imagen)
STATIC_DIR = Path(os.getenv("STATIC_DIR", BASE_DIR.parent / "frontend" / "dist"))

# Tamaño máximo del logo del negocio
MAX_LOGO_BYTES = 2 * 1024 * 1024

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL

# Motor de conexión de SQLAlchemy (pool_pre_ping evita errores si la BD se reinició)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Sesión local para interactuar con la base de datos
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base para declarar los modelos de las tablas
Base = declarative_base()

# Función de utilidad para obtener una sesión de base de datos en las rutas
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

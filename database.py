from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Cadena de conexión: postgresql://usuario:contraseña@servidor:puerto/nombre_bd
DATABASE_URL = "postgresql+psycopg2://invtory_user:REDACTED@localhost:5432/inventory_db"
# Motor de conexión de SQLAlchemy
engine = create_engine(DATABASE_URL)

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
"""
Pruebas automáticas del API. Necesitan una base de datos PostgreSQL VACÍA dedicada
a pruebas (se borra por completo en cada ejecución). Ejemplo:

    TEST_DATABASE_URL=postgresql+psycopg2://inventory:inventory@localhost:5432/inventory_test pytest
"""
import os
import sys
from pathlib import Path

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit("Define TEST_DATABASE_URL con una base de datos de pruebas (se borrará).", returncode=2)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "clave-solo-para-pruebas-no-usar-en-produccion"
os.environ["AUTO_UPDATE_RATE"] = "0"  # Las pruebas no deben consultar internet
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from database import engine  # noqa: E402

ADMIN = {"username": "admin", "password": "secreto123"}


@pytest.fixture(scope="session")
def app():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    from main import app as fastapi_app

    with TestClient(fastapi_app):  # Ejecuta las migraciones al iniciar
        yield fastapi_app


@pytest.fixture()
def client(app):
    """Cliente HTTP sobre una base de datos limpia, con el sistema ya configurado."""
    with engine.begin() as conn:
        tables = conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'alembic_version'"
        )).scalars().all()
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
    return TestClient(app)


@pytest.fixture()
def admin(client):
    """Configura el sistema y devuelve un cliente con sesión de administrador."""
    response = client.post("/api/setup", json={"business_name": "Bodega Prueba", **ADMIN})
    assert response.status_code == 201, response.text
    client.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
    return client


@pytest.fixture()
def cashier(admin, app):
    """Crea un cajero y devuelve un cliente distinto con su sesión."""
    admin.post("/api/users", json={"username": "caja1", "password": "caja1234", "role": "cashier"})
    other = TestClient(app)
    token = other.post("/api/login", data={"username": "caja1", "password": "caja1234"}).json()["access_token"]
    other.headers["Authorization"] = f"Bearer {token}"
    return other


@pytest.fixture()
def catalog(admin):
    """Una categoría y dos productos con stock."""
    category = admin.post("/api/categories", json={"name": "Bebidas"}).json()
    soda = admin.post("/api/products", json={
        "code": "001", "name": "Refresco", "price": "1.50", "cost": "0.90",
        "stock": 10, "min_stock": 3, "category_id": category["category_id"],
    }).json()
    water = admin.post("/api/products", json={
        "code": "002", "name": "Agua", "price": "0.99", "cost": "0.40",
        "stock": 5, "min_stock": 2, "category_id": category["category_id"],
    }).json()
    return {"category": category, "soda": soda, "water": water}

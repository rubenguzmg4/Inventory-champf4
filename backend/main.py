import logging
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse

import auth
import config
from common import get_settings
from database import SessionLocal
from routers import account, bills, categories, clients, entries, products, reports, settings, users

logger = logging.getLogger("inventario")


def run_migrations():
    """Crea o actualiza las tablas de la base de datos automáticamente al iniciar."""
    alembic_cfg = Config(str(config.BASE_DIR / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(config.BASE_DIR / "alembic"))
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_migrations()
    with SessionLocal() as db:
        get_settings(db)
        auth.load_secret_key(db)
    yield


# Inicialización de la Aplicación
app = FastAPI(
    title="Sistema de Control de Inventario y Facturación",
    description="API para gestión de productos, clientes, entradas de mercancía, facturación y reportes.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

# Todas las rutas del API empiezan con /api; el resto lo atiende la interfaz web
api = APIRouter(prefix="/api")
for module in (account, users, settings, categories, products, entries, clients, bills, reports):
    api.include_router(module.router)


@api.get("/health", tags=["Inicio"])
def health():
    return {"status": "ok"}


@api.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    raise HTTPException(status_code=404, detail="Ruta del API no encontrada.")


app.include_router(api)


# ==========================================
# INTERFAZ WEB (archivos compilados de /frontend)
# ==========================================
@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    static_dir = config.STATIC_DIR.resolve()
    index = static_dir / "index.html"
    if not index.exists():
        return {
            "mensaje": "¡Bienvenido al API del Sistema de Inventario y Facturación!",
            "documentacion": "Visita /api/docs para interactuar con la API",
            "interfaz": "La interfaz web no está compilada. Ejecuta 'npm run build' en /frontend o usa Docker.",
        }
    requested = (static_dir / path).resolve()
    # Archivos reales (JS, CSS, imágenes); cualquier otra ruta la resuelve la app de React
    if path and requested.is_file() and requested.is_relative_to(static_dir):
        return FileResponse(requested)
    return FileResponse(index, headers={"Cache-Control": "no-cache"})

# Sistema de Inventario y Facturación

Aplicación web para llevar el inventario, facturar y ver reportes de un negocio.
Funciona en cualquier equipo (Windows, Mac o Linux) gracias a **Docker**, y se puede usar
desde otros dispositivos de la misma red (celular, tablet u otra computadora) con el navegador.

## ¿Qué incluye?

- **Facturar (punto de venta):** búsqueda por nombre, marca o con lector de código de barras, carrito,
  cliente, forma de pago, impuesto (IVA) y total en una segunda moneda (bolívares).
  Atajos: `F2` buscar, `F9` cobrar.
- **Tasa del BCV:** se consulta sola al iniciar y luego cada hora (en Configuración → Facturación puedes ver
  cuándo se actualizó, forzarla con "Actualizar ahora" o cambiar a modo manual y escribir la tasa que prefieras).
  Necesita internet; si falla, se conserva la última tasa y el inicio muestra un aviso.
- **Facturas:** historial con filtros, impresión en hoja (A4/carta) o ticket de 80 mm, con el logo del local,
  y anulación (devuelve los productos al inventario).
- **Productos y categorías:** código automático (000001, 000002… o el código de barras que escribas), marca
  (con filtro por marca y por categoría), precios, costos, margen, stock mínimo, ajustes de stock con motivo
  (conteo físico, merma…) e historial de movimientos de cada producto (kárdex).
- **Reposición de stock:** lista de productos agotados, bajo el mínimo o que se agotarán pronto, con la
  **cantidad sugerida a pedir** según las ventas de los últimos 30 días. Registro de entradas de mercancía.
- **Reportes:** ventas por día, forma de pago, categoría, cajero y producto, ganancia bruta, inventario
  valorizado. Se pueden imprimir o descargar en CSV (se abre en Excel).
- **Usuarios:** administradores y cajeros (los cajeros solo facturan y consultan). Un usuario sin historial se
  elimina; si ya emitió facturas se desactiva para no perder el historial.
- **Personalización:** logo del local, color principal, color de la barra lateral, modo claro/oscuro y bordes.

## 1. Instalar Docker (una sola vez)

- **Windows / Mac:** instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) y ábrelo.
- **Linux:** instala Docker Engine y el plugin *compose* (en Debian/Ubuntu: `sudo apt install docker.io docker-compose-v2`).

## 2. Iniciar la aplicación

Abre una terminal (en Windows: PowerShell) dentro de la carpeta del proyecto y ejecuta:

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos. Luego abre **http://localhost:8000** en el navegador.
La primera pantalla te pide el nombre del negocio y crea el usuario administrador.

Después ve a **Configuración** para subir el logo, elegir los colores, el IVA y la tasa de cambio.

La aplicación se vuelve a encender sola cada vez que Docker arranca. Para detenerla:

```bash
docker compose down
```

> Los datos **no** se borran al detener la aplicación: quedan guardados en este equipo, en un volumen de Docker.
> Solo se perderían con `docker compose down -v` (¡no uses `-v`!).

## 3. Usarla desde otros dispositivos

Cualquier celular, tablet o computadora conectado a la **misma red (Wi-Fi)** puede entrar con el navegador a
`http://IP-DEL-EQUIPO:8000`. Para saber la IP del equipo donde corre Docker:

- Windows: `ipconfig` (busca "Dirección IPv4", por ejemplo `192.168.1.20`).
- Mac / Linux: `ip addr` o en Preferencias de red.

Si no conecta, permite el puerto 8000 en el firewall del equipo.

## 4. Respaldos (¡importante!)

Crear un respaldo (queda en la carpeta `respaldos/` del proyecto):

```bash
docker compose exec db sh -c 'pg_dump -U inventory -d inventory_db -Fc -f /respaldos/respaldo_$(date +%Y-%m-%d_%H%M).dump'
```

Copia esa carpeta a un pendrive o a la nube con frecuencia. Para restaurar un respaldo
(reemplaza los datos actuales por los del archivo):

```bash
docker compose stop app
docker compose exec db pg_restore -U inventory -d inventory_db --clean --if-exists /respaldos/NOMBRE_DEL_ARCHIVO.dump
docker compose start app
```

## 5. Actualizar después de cambiar el código

```bash
docker compose up -d --build
```

Los cambios en la base de datos (tablas o columnas nuevas) se aplican solos al iniciar,
gracias a las migraciones de `backend/alembic/versions/`.

## Configuración opcional

Copia `.env.example` como `.env` para cambiar la contraseña de la base de datos, el puerto o la zona horaria.
Cambia `DB_PASSWORD` **antes** del primer inicio.

---

## Para desarrollar (sin Docker)

Necesitas Python 3.11+, Node.js 20+ y un PostgreSQL con una base de datos **vacía**.

**Backend** (http://localhost:8000, documentación del API en http://localhost:8000/api/docs):

```bash
cd backend
python -m venv venv
source venv/bin/activate        # En Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # y ajusta DATABASE_URL
uvicorn main:app --reload
```

**Interfaz web** (http://localhost:5173, se conecta sola al backend):

```bash
cd frontend
npm install
npm run dev
```

**Pruebas automáticas** (usan una base de datos de pruebas que se borra en cada ejecución):

```bash
cd backend
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql+psycopg2://usuario:clave@localhost:5432/inventory_test pytest
```

### Cambiar la base de datos

1. Modifica `backend/models.py`.
2. Genera la migración: `cd backend && alembic revision --autogenerate -m "descripcion del cambio"`.
3. Revisa el archivo creado en `backend/alembic/versions/` y reinicia la aplicación.

## Estructura del proyecto

```
backend/                 Servidor (FastAPI + SQLAlchemy + PostgreSQL)
  main.py                Arranque, migraciones automáticas y entrega de la interfaz web
  models.py              Tablas de la base de datos
  schemas.py             Validación de los datos que entran y salen del API
  auth.py                Contraseñas, sesiones (JWT) y permisos
  routers/               Un archivo por módulo: productos, facturas, reportes…
  alembic/               Migraciones de la base de datos
  tests/                 Pruebas automáticas
frontend/                Interfaz web (React + Mantine)
  src/pages/             Una pantalla por archivo
  src/components/        Piezas reutilizables (factura, formularios, menú…)
  src/theme.js           Colores y estilo (se generan a partir de la configuración)
Dockerfile               Construye la imagen de la aplicación
docker-compose.yml       Levanta la aplicación y la base de datos juntas
```

## Nota sobre facturación fiscal

Las facturas que emite el sistema son de control interno. Para facturas con validez fiscal (SENIAT)
se necesita una impresora fiscal o un proveedor de facturación digital autorizado.

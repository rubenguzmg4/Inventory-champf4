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
  subtotal, IVA y total en dólares **y en bolívares** (con la tasa del momento), y anulación (devuelve los
  productos al inventario).
- **Productos y categorías:** código automático (000001, 000002… o el código de barras que escribas), marca
  (con filtro por marca y por categoría), precios, costos, margen, stock mínimo, ajustes de stock con motivo
  (conteo físico, merma…) e historial de movimientos de cada producto (kárdex).
- **Reposición de stock:** lista de productos agotados, bajo el mínimo o que se agotarán pronto, con la
  **cantidad sugerida a pedir** según las ventas de los últimos 30 días. Registro de entradas de mercancía.
- **Reportes:** ventas por día, forma de pago, categoría y cajero, ganancia bruta e inventario valorizado.
  Productos más vendidos **por unidades** y **por dinero generado**, que se pueden filtrar por categoría
  (por ejemplo, el más vendido de Perfumería). El Inicio muestra lo más vendido del mes por unidades. Se pueden imprimir o descargar en CSV (se abre en Excel).
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

## Instalar en otro equipo con Windows 11

No necesitas instalar PostgreSQL, Python ni Node: todo va dentro de Docker.

1. **Instala Docker Desktop** desde https://www.docker.com/products/docker-desktop/. Acepta WSL 2 si lo ofrece,
   reinicia cuando lo pida y abre Docker Desktop (espera a que indique que el motor está en marcha). Si da un error
   de virtualización, actívala en la BIOS del equipo (Intel VT-x / AMD-V).
2. **Copia el proyecto** al equipo:
   - Con Git: instala [Git para Windows](https://git-scm.com/download/win) y en PowerShell ejecuta
     `git clone https://github.com/rubenguzmg4/Inventory-champf4.git` (el repositorio es privado: abrirá el
     navegador para que inicies sesión en GitHub).
   - Sin Git: en la página del repositorio, botón **Code → Download ZIP**, y descomprímelo.
3. **Abre PowerShell dentro de la carpeta** del proyecto (clic derecho en la carpeta → "Abrir en Terminal") y ejecuta:

   ```bash
   docker compose up -d --build
   ```

   La primera vez tarda varios minutos y necesita internet.
4. Abre **http://localhost:8000** en el navegador. Verás la pantalla de bienvenida (equipo nuevo, sin datos).
5. Para que se encienda sola con el equipo: en Docker Desktop, **Settings → General → "Start Docker Desktop when
   you sign in"**. La aplicación y la base de datos se reinician solas con Docker.
6. Para entrar desde otros dispositivos de la red, usa `http://IP-DEL-EQUIPO:8000` (la IP sale con `ipconfig`,
   "Dirección IPv4"). Si no conecta, permite el puerto en el Firewall de Windows ejecutando PowerShell **como
   administrador**:

   ```bash
   New-NetFirewallRule -DisplayName "Inventario" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
   ```

## 3. Usarla desde otros dispositivos

Cualquier celular, tablet o computadora conectado a la **misma red (Wi-Fi)** puede entrar con el navegador a
`http://IP-DEL-EQUIPO:8000`. Para saber la IP del equipo donde corre Docker:

- Windows: `ipconfig` (busca "Dirección IPv4", por ejemplo `192.168.1.20`).
- Mac / Linux: `ip addr` o en Preferencias de red.

Si no conecta, permite el puerto 8000 en el firewall del equipo.

## 4. Respaldos automáticos (¡importante!)

**Qué hace:** todos los días a las **6:30 p. m.** (hora de Venezuela) guarda una copia de toda la base de datos
(productos, facturas, clientes, usuarios, logo y configuración) en la carpeta `respaldos/` del proyecto, y conserva
solo las **últimas 20 copias** (borra las más viejas). Cada archivo se llama `respaldo_AAAA-MM-DD_HHMM.dump`.
Si el equipo está apagado a esa hora, la copia se hace cuando se encienda. Además se hace una al iniciar por
primera vez. No hay que acordarse de nada: es un servicio más de Docker.

**Cambiar la carpeta, la hora o la cantidad.** Copia `.env.example` como `.env` (misma carpeta que
`docker-compose.yml`) y edita estas líneas; luego ejecuta `docker compose up -d`:

```
BACKUP_DIR=C:/Respaldos      # carpeta donde se guardan (en Windows, con barras normales /)
BACKUP_TIME=18:30            # hora en formato 24 h
BACKUP_KEEP=20               # cuántas copias se conservan
```

**Enviarlos a la nube con Google Drive.** Un respaldo en el mismo equipo no protege si el equipo se pierde, así que
la carpeta debe sincronizarse con la nube:
1. Instala **Google Drive para escritorio** e inicia sesión con la cuenta que tiene el espacio.
2. Usa una carpeta normal del disco (por ejemplo `C:\Respaldos`, la misma de `BACKUP_DIR`) y en las preferencias de
   Google Drive agrégala a las carpetas que se sincronizan con la nube. Los nombres exactos de los menús pueden
   variar según la versión.
3. **No pongas `BACKUP_DIR` dentro de la unidad virtual `G:` de Drive**: Docker suele fallar al escribir ahí.
4. Comprueba en drive.google.com que aparecen los archivos `.dump`.

**Comprobar que funciona:**

```bash
docker compose logs backup
```

**Hacer un respaldo ahora mismo** (por ejemplo, antes de actualizar el sistema):

```bash
docker compose exec backup /backup.sh now
```

**Restaurar** (recuperar datos o pasarlos a otro equipo). Esto **reemplaza todos los datos actuales** por los del archivo:
1. En el equipo nuevo, instala Docker, descarga el proyecto e inícialo con `docker compose up -d --build`
   (con el mismo `.env` si usas uno).
2. Copia el archivo `.dump` que quieras recuperar a la carpeta de respaldos (`BACKUP_DIR`).
3. Detén la aplicación, restaura y vuélvela a iniciar (cambia el nombre del archivo por el tuyo):

```bash
docker compose stop app
```
```bash
docker compose exec backup /backup.sh restore respaldo_2026-10-12_1830.dump
```
```bash
docker compose start app
```

Si algo falla al restaurar, la base de datos queda como estaba. **Prueba una restauración de vez en cuando**: un
respaldo que nunca se probó no es una garantía.

## 5. Actualizar después de cambiar el código

```bash
docker compose up -d --build
```

Los cambios en la base de datos (tablas o columnas nuevas) se aplican solos al iniciar,
gracias a las migraciones de `backend/alembic/versions/`.

## Cambiar los textos de ejemplo (adaptarlos al tipo de negocio)

Los textos grises que aparecen dentro de los campos vacíos (por ejemplo "Ej. Shampoo reparador 400 ml") están
todos en un solo archivo: **`frontend/src/examples.js`**. Ahí también están los motivos de ajuste de stock y el
mensaje de "crea tu primera categoría". Edita el texto entre comillas, guarda y reconstruye:

```bash
docker compose up -d --build
```

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
backup/                  Servicio de respaldos automáticos (script y su imagen)
Dockerfile               Construye la imagen de la aplicación
docker-compose.yml       Levanta la aplicación y la base de datos juntas
```

## Nota sobre facturación fiscal

Las facturas que emite el sistema son de control interno. Para facturas con validez fiscal (SENIAT)
se necesita una impresora fiscal o un proveedor de facturación digital autorizado.

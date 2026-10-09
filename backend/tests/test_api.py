from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from conftest import ADMIN

import exchange_rate

TZ = "America/Caracas"


def bill(client, items, client_id="0", **extra):
    return client.post("/api/bills", json={"client_id": client_id, "items": items, **extra})


def stock_of(client, product_id):
    return client.get(f"/api/products/{product_id}").json()["stock"]


# ---------- Sesión y usuarios ----------

def test_setup_only_once(client):
    assert client.get("/api/setup").json() == {"needs_setup": True}
    first = client.post("/api/setup", json={"business_name": "Mi Bodega", **ADMIN})
    assert first.status_code == 201
    assert first.json()["user"]["role"] == "admin"
    assert client.get("/api/setup").json() == {"needs_setup": False}
    # Se crea el cliente genérico y se guarda el nombre del negocio
    assert client.get("/api/settings/public").json()["business_name"] == "Mi Bodega"

    second = client.post("/api/setup", json={"business_name": "Otra", "username": "intruso", "password": "123456"})
    assert second.status_code == 409


def test_login_and_wrong_password(admin):
    ok = admin.post("/api/login", data=ADMIN)
    assert ok.status_code == 200 and ok.json()["access_token"]
    bad = admin.post("/api/login", data={"username": "admin", "password": "otra-cosa"})
    assert bad.status_code == 401


def test_requests_without_token_are_rejected(client):
    assert client.get("/api/products").status_code == 401


def test_cashier_permissions(cashier, catalog):
    assert cashier.get("/api/products").status_code == 200
    # El cajero no ve el costo de compra
    assert cashier.get("/api/products").json()[0]["cost"] is None
    assert cashier.post("/api/categories", json={"name": "X"}).status_code == 403
    assert cashier.post("/api/users", json={"username": "otro", "password": "123456"}).status_code == 403
    assert cashier.get("/api/reports/dashboard").status_code == 403
    assert cashier.post("/api/entries", json={"product_id": catalog["soda"]["product_id"], "quantity": 5}).status_code == 403
    # Pero sí puede facturar
    assert bill(cashier, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}]).status_code == 201


def test_deactivated_user_cannot_use_token(admin, cashier):
    users = admin.get("/api/users").json()
    cashier_id = next(u["user_id"] for u in users if u["username"] == "caja1")
    admin.put(f"/api/users/{cashier_id}", json={"is_active": False})
    assert cashier.get("/api/products").status_code == 401


def test_last_admin_is_protected(admin):
    me = admin.get("/api/me").json()
    response = admin.put(f"/api/users/{me['user_id']}", json={"role": "cashier"})
    assert response.status_code == 400


def test_delete_user(admin, cashier, catalog):
    users = admin.get("/api/users").json()
    me = next(u for u in users if u["username"] == "admin")
    cashier_id = next(u["user_id"] for u in users if u["username"] == "caja1")

    assert admin.delete(f"/api/users/{me['user_id']}").status_code == 400  # No puede eliminarse a sí mismo
    assert admin.delete("/api/users/9999").status_code == 404
    assert cashier.delete(f"/api/users/{me['user_id']}").status_code == 403  # Solo administradores

    # Un cajero con ventas se desactiva (se conserva quién emitió cada factura)
    assert bill(cashier, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}]).status_code == 201
    result = admin.delete(f"/api/users/{cashier_id}").json()
    assert result["deleted"] is False
    assert next(u for u in admin.get("/api/users").json() if u["user_id"] == cashier_id)["is_active"] is False
    assert admin.get("/api/bills").json()[0]["cashier_name"] == "caja1"

    # Un usuario sin historial sí se elimina de verdad
    admin.post("/api/users", json={"username": "nuevo", "password": "nuevo123"})
    new_id = next(u["user_id"] for u in admin.get("/api/users").json() if u["username"] == "nuevo")
    assert admin.delete(f"/api/users/{new_id}").json()["deleted"] is True
    assert "nuevo" not in [u["username"] for u in admin.get("/api/users").json()]


def test_change_password(admin):
    wrong = admin.put("/api/me/password", json={"current_password": "nope", "new_password": "nueva123"})
    assert wrong.status_code == 400
    ok = admin.put("/api/me/password", json={"current_password": ADMIN["password"], "new_password": "nueva123"})
    assert ok.status_code == 204
    assert admin.post("/api/login", data={"username": "admin", "password": "nueva123"}).status_code == 200


# ---------- Productos y stock ----------

def test_initial_stock_creates_entry(admin, catalog):
    entries = admin.get("/api/entries").json()
    assert {e["note"] for e in entries} == {"Stock inicial"}
    assert sum(e["quantity"] for e in entries) == 15


def test_product_search_ignores_accents(admin, catalog):
    admin.post("/api/products", json={"name": "Café molido", "price": "3", "category_id": catalog["category"]["category_id"]})
    assert [p["name"] for p in admin.get("/api/products", params={"search": "cafe"}).json()] == ["Café molido"]
    assert [p["name"] for p in admin.get("/api/products", params={"search": "002"}).json()] == ["Agua"]
    assert admin.get("/api/products", params={"search": "100%"}).json() == []


def test_product_brand_and_filter(admin, catalog):
    category = catalog["category"]["category_id"]
    polar = admin.post("/api/products", json={"name": "Cerveza", "brand": "  Polar ", "price": "1.2", "category_id": category})
    assert polar.status_code == 201 and polar.json()["brand"] == "Polar"  # Se limpian los espacios
    admin.post("/api/products", json={"name": "Malta", "brand": "polar", "price": "1", "category_id": category})
    admin.post("/api/products", json={"name": "Jugo", "brand": "Yukery", "price": "2", "category_id": category})

    # Un producto sin marca sigue siendo válido
    assert catalog["soda"]["brand"] is None
    # Las marcas se listan sin repetir por mayúsculas, ordenadas
    assert admin.get("/api/products/brands").json() == ["Polar", "Yukery"]
    # Filtro por marca (sin distinguir mayúsculas) y búsqueda por marca
    assert {p["name"] for p in admin.get("/api/products", params={"brand": "POLAR"}).json()} == {"Cerveza", "Malta"}
    assert [p["name"] for p in admin.get("/api/products", params={"search": "yuker"}).json()] == ["Jugo"]
    # Combinado con la categoría
    assert len(admin.get("/api/products", params={"brand": "polar", "category_id": category}).json()) == 2
    assert admin.get("/api/products", params={"brand": "polar", "category_id": 999}).json() == []

    # Editar y quitar la marca
    product_id = polar.json()["product_id"]
    assert admin.put(f"/api/products/{product_id}", json={"brand": "Regional"}).json()["brand"] == "Regional"
    assert admin.put(f"/api/products/{product_id}", json={"price": "1.50"}).json()["brand"] == "Regional"  # No se toca si no se envía
    assert admin.put(f"/api/products/{product_id}", json={"brand": ""}).json()["brand"] is None


def test_product_codes_are_generated(admin):
    category = admin.post("/api/categories", json={"name": "Varios"}).json()["category_id"]

    def create(**extra):
        response = admin.post("/api/products", json={"name": "Producto", "price": "1", "category_id": category, **extra})
        assert response.status_code == 201, response.text
        return response.json()

    # Sin código (o con espacios en blanco) se asigna el siguiente correlativo
    assert [create()["code"], create(code="")["code"], create(code="   ")["code"]] == ["000001", "000002", "000003"]
    # Un código escrito a mano (por ejemplo, de barras) se respeta
    assert create(code="7591234567890")["code"] == "7591234567890"
    # Si alguien escribió a mano el que tocaba, se salta al siguiente
    create(code="000004")
    assert create()["code"] == "000005"
    # Un producto eliminado no libera su número
    last = create()
    assert last["code"] == "000006"
    assert admin.delete(f"/api/products/{last['product_id']}").json()["deleted"] is True
    assert create()["code"] == "000007"

    # Al editar: vacío conserva el código, uno nuevo lo reemplaza y no se admiten repetidos
    product_id = create()["product_id"]
    kept = admin.put(f"/api/products/{product_id}", json={"code": ""}).json()["code"]
    assert kept == "000008"
    assert admin.put(f"/api/products/{product_id}", json={"code": " ABC-1 "}).json()["code"] == "ABC-1"
    assert admin.put(f"/api/products/{product_id}", json={"code": "000001"}).status_code == 400
    assert admin.put(f"/api/products/{product_id}", json={"price": "2"}).json()["code"] == "ABC-1"


def test_duplicate_code_rejected(admin, catalog):
    response = admin.post("/api/products", json={
        "code": "001", "name": "Otro", "price": "1", "category_id": catalog["category"]["category_id"],
    })
    assert response.status_code == 400


def test_entry_adds_stock_and_updates_cost(admin, catalog):
    soda = catalog["soda"]["product_id"]
    response = admin.post("/api/entries", json={"product_id": soda, "quantity": 20, "unit_cost": "1.10", "supplier": "Distribuidora"})
    assert response.status_code == 201
    product = admin.get(f"/api/products/{soda}").json()
    assert product["stock"] == 30
    assert product["cost"] == 1.10


def test_entry_quantity_must_be_positive(admin, catalog):
    response = admin.post("/api/entries", json={"product_id": catalog["soda"]["product_id"], "quantity": 0})
    assert response.status_code == 422


def test_stock_adjustment_and_movements(admin, catalog):
    soda = catalog["soda"]["product_id"]
    response = admin.post(f"/api/products/{soda}/adjust", json={"new_stock": 7, "reason": "Conteo físico"})
    assert response.status_code == 200 and response.json()["stock"] == 7
    bill(admin, [{"product_id": soda, "quantity": 2}])
    movements = admin.get(f"/api/products/{soda}/movements").json()
    assert [m["type"] for m in movements] == ["venta", "ajuste", "entrada"]
    assert [m["quantity"] for m in movements] == [-2, -3, 10]


def test_delete_product_with_sales_deactivates(admin, catalog):
    soda, water = catalog["soda"]["product_id"], catalog["water"]["product_id"]
    bill(admin, [{"product_id": soda, "quantity": 1}])

    sold = admin.delete(f"/api/products/{soda}").json()
    assert sold["deleted"] is False
    assert admin.get(f"/api/products/{soda}").json()["is_active"] is False

    unsold = admin.delete(f"/api/products/{water}").json()
    assert unsold["deleted"] is True
    assert admin.get(f"/api/products/{water}").status_code == 404


def test_category_with_products_cannot_be_deleted(admin, catalog):
    response = admin.delete(f"/api/categories/{catalog['category']['category_id']}")
    assert response.status_code == 400


# ---------- Facturación ----------

def test_bill_discounts_stock_and_computes_tax(admin, catalog):
    admin.put("/api/settings", json={"tax_rate": "16", "exchange_rate_mode": "manual", "exchange_rate": "40.5"})
    soda, water = catalog["soda"]["product_id"], catalog["water"]["product_id"]

    response = bill(admin, [{"product_id": soda, "quantity": 3}, {"product_id": water, "quantity": 2}], payment_method="Pago móvil")
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["subtotal"] == 6.48  # 3 × 1.50 + 2 × 0.99
    assert data["tax_amount"] == 1.04  # 16 % de 6.48 = 1.0368
    assert data["total"] == 7.52
    assert data["exchange_rate"] == 40.5
    assert data["payment_method"] == "Pago móvil"
    assert data["client"]["name"] == "Consumidor"
    assert [d["product_name"] for d in data["details"]] == ["Refresco", "Agua"]
    assert stock_of(admin, soda) == 7
    assert stock_of(admin, water) == 3


def test_duplicate_lines_are_merged(admin, catalog):
    soda = catalog["soda"]["product_id"]
    data = bill(admin, [{"product_id": soda, "quantity": 2}, {"product_id": soda, "quantity": 3}]).json()
    assert len(data["details"]) == 1 and data["details"][0]["quantity"] == 5
    assert stock_of(admin, soda) == 5


def test_insufficient_stock_changes_nothing(admin, catalog):
    soda, water = catalog["soda"]["product_id"], catalog["water"]["product_id"]
    response = bill(admin, [{"product_id": soda, "quantity": 2}, {"product_id": water, "quantity": 99}])
    assert response.status_code == 400
    assert "Stock insuficiente" in response.json()["detail"]
    assert stock_of(admin, soda) == 10
    assert admin.get("/api/bills").json() == []


def test_invalid_quantities_rejected(admin, catalog):
    soda = catalog["soda"]["product_id"]
    assert bill(admin, [{"product_id": soda, "quantity": -5}]).status_code == 422
    assert bill(admin, [{"product_id": soda, "quantity": 0}]).status_code == 422
    assert bill(admin, []).status_code == 422
    assert stock_of(admin, soda) == 10


def test_unknown_client_rejected(admin, catalog):
    response = bill(admin, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}], client_id="V-999")
    assert response.status_code == 404


def test_void_bill_restores_stock(admin, catalog):
    soda = catalog["soda"]["product_id"]
    bill_id = bill(admin, [{"product_id": soda, "quantity": 4}]).json()["bill_id"]
    assert stock_of(admin, soda) == 6

    voided = admin.post(f"/api/bills/{bill_id}/void", json={"reason": "Error de cobro"})
    assert voided.status_code == 200
    assert voided.json()["status"] == "void"
    assert stock_of(admin, soda) == 10
    # No se puede anular dos veces
    assert admin.post(f"/api/bills/{bill_id}/void", json={"reason": "otra vez"}).status_code == 400


def test_bill_search(admin, catalog):
    admin.post("/api/clients", json={"client_id": "v-12345678", "name": "María", "lastname": "Pérez"})
    bill(admin, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}], client_id="V-12345678")
    bill(admin, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}])
    assert len(admin.get("/api/bills", params={"search": "maría"}).json()) == 1
    # La búsqueda ignora acentos y mayúsculas
    assert len(admin.get("/api/bills", params={"search": "maria perez"}).json()) == 1
    assert [c["name"] for c in admin.get("/api/clients", params={"search": "MARIA"}).json()] == ["María"]
    assert len(admin.get("/api/bills", params={"search": "#000001"}).json()) == 1
    assert len(admin.get("/api/bills").json()) == 2


# ---------- Reposición y reportes ----------

def test_replenishment_suggestions(admin, catalog):
    soda, water = catalog["soda"]["product_id"], catalog["water"]["product_id"]
    bill(admin, [{"product_id": water, "quantity": 4}])  # Agua queda en 1 (mínimo 2)
    bill(admin, [{"product_id": soda, "quantity": 7}])  # Refresco queda en 3 (mínimo 3)

    items = {i["product_id"]: i for i in admin.get("/api/products/replenishment").json()}
    assert items[water]["status"] == "low"
    assert items[soda]["status"] == "low"
    # 7 vendidos en 30 días → 0.23/día × 15 días ≈ 4 + mínimo 3 − stock 3 = 4
    assert items[soda]["suggested_quantity"] == 4
    assert items[soda]["estimated_cost"] == 3.60


def test_sales_report(admin, catalog):
    soda, water = catalog["soda"]["product_id"], catalog["water"]["product_id"]
    bill(admin, [{"product_id": soda, "quantity": 2}], payment_method="Efectivo")
    bill(admin, [{"product_id": water, "quantity": 1}], payment_method="Pago móvil")
    voided = bill(admin, [{"product_id": soda, "quantity": 1}]).json()["bill_id"]
    admin.post(f"/api/bills/{voided}/void", json={"reason": "prueba"})

    today = datetime.now(ZoneInfo(TZ)).date().isoformat()
    report = admin.get("/api/reports/sales", params={"date_from": today, "date_to": today, "tz": TZ})
    assert report.status_code == 200, report.text
    data = report.json()
    assert data["summary"]["bills_count"] == 2
    assert data["summary"]["total"] == 3.99
    assert data["summary"]["gross_profit"] == round(3.99 - (2 * 0.90 + 0.40), 2)
    assert data["summary"]["voided_count"] == 1
    assert data["by_day"] == [{"date": today, "total": 3.99, "count": 2}]
    assert {p["method"] for p in data["by_payment_method"]} == {"Efectivo", "Pago móvil"}
    assert data["by_category"][0]["category"] == "Bebidas"
    assert data["top_products"][0]["name"] == "Refresco"


def test_dashboard_and_inventory(admin, catalog):
    bill(admin, [{"product_id": catalog["water"]["product_id"], "quantity": 4}])
    dash = admin.get("/api/reports/dashboard", params={"tz": TZ})
    assert dash.status_code == 200, dash.text
    data = dash.json()
    assert data["today"]["count"] == 1
    assert data["low_stock_count"] == 1
    assert len(data["sales_by_day"]) == 30
    assert data["recent_bills"][0]["client_name"] == "Consumidor Final"

    inventory = admin.get("/api/reports/inventory").json()
    assert inventory["totals"]["units"] == 11
    assert inventory["totals"]["value_cost"] == 10 * 0.90 + 1 * 0.40


def test_invalid_timezone(admin):
    response = admin.get("/api/reports/dashboard", params={"tz": "Marte/Base"})
    assert response.status_code == 400


# ---------- Configuración ----------

def test_settings_update_and_validation(admin):
    ok = admin.put("/api/settings", json={"primary_color": "#e8590c", "payment_methods": ["Efectivo", "Zelle", "Efectivo"]})
    assert ok.status_code == 200
    assert ok.json()["payment_methods"] == ["Efectivo", "Zelle"]
    assert admin.put("/api/settings", json={"primary_color": "rojo"}).status_code == 422
    assert admin.put("/api/settings", json={"tax_rate": "150"}).status_code == 422


def test_blank_optional_fields_are_saved_as_null(admin):
    """Los formularios envían "" en los campos opcionales vacíos."""
    settings = admin.put("/api/settings", json={"tax_id": "", "address": "  ", "phone": "0212-555", "sidebar_color": None})
    assert settings.status_code == 200, settings.text
    assert settings.json()["tax_id"] is None and settings.json()["phone"] == "0212-555"

    client = admin.post("/api/clients", json={"client_id": "V-1", "name": "Ana", "lastname": "", "phone": "", "email": "", "address": ""})
    assert client.status_code == 201, client.text
    assert client.json()["phone"] is None
    assert admin.post("/api/clients", json={"client_id": "V-2", "name": "Ana", "phone": "1" * 21}).status_code == 422


def test_logo_upload(admin):
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    response = admin.put("/api/settings/logo", files={"file": ("logo.png", png, "image/png")})
    assert response.status_code == 200
    logo_url = response.json()["logo_url"]
    assert logo_url.startswith("/api/settings/logo")

    public = admin.get(logo_url)
    assert public.status_code == 200 and public.headers["content-type"] == "image/png"

    fake = admin.put("/api/settings/logo", files={"file": ("logo.png", b"<svg onload=alert(1)>", "image/png")})
    assert fake.status_code == 400


def test_unknown_api_route_is_404(admin):
    assert admin.get("/api/no-existe").status_code == 404


def test_concurrent_bills_never_oversell(admin, catalog, app):
    """Dos cajas venden 6 refrescos a la vez con stock 10: solo una puede lograrlo."""
    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    soda = catalog["soda"]["product_id"]
    registers = []
    for _ in range(2):
        register = TestClient(app)
        register.headers["Authorization"] = admin.headers["Authorization"]
        registers.append(register)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda c: bill(c, [{"product_id": soda, "quantity": 6}]).status_code, registers))

    assert sorted(results) == [201, 400]
    assert stock_of(admin, soda) == 4


# ---------- Tasa del BCV ----------

# Respuestas reales (recortadas) de las dos fuentes, tomadas el 08/10/2026
DOLARAPI_SAMPLE = {
    "moneda": "USD", "fuente": "oficial", "nombre": "Dólar", "compra": None, "venta": None,
    "promedio": 874.7321, "fechaActualizacion": "2026-10-08T00:00:00-04:00",
}
BCV_SAMPLE = """
<div id="euro"><strong class="strong-tb"> 1.020,50000000</strong></div>
<div id="dolar" class="col-sm-12 col-xs-12 "> <div class="field-content"> <div class="row recuadrotsmc">
<div class="col-sm-6 col-xs-6"> <img src="/sites/default/files/dollar-04_2.png"> <span> USD</span> </div>
<div class="col-sm-6 col-xs-6 centrado textp"> <strong class="strong-tb">875,65050000</strong> </div> </div> </div> </div>
<div class="pull-right dinpro center"> Fecha Valor: <span class="date-display-single" property="dc:date"
content="2026-10-09T00:00:00-04:00">Viernes, 09 Octubre 2026</span> <hr> </div>
"""


def fake_fetch(rate="874.7321", value_date=date(2026, 10, 8), source="BCV oficial (vía DolarApi.com)"):
    def fetch(previous=None):
        return exchange_rate.RateResult(Decimal(rate), value_date, source)
    return fetch


def failing_fetch(previous=None):
    raise exchange_rate.RateError("sin conexión de prueba")


def test_parse_sources():
    api = exchange_rate.parse_dolarapi(DOLARAPI_SAMPLE)
    assert (api.rate, api.value_date) == (Decimal("874.7321"), date(2026, 10, 8))

    page = exchange_rate.parse_bcv(BCV_SAMPLE)  # Toma el dólar, no el euro que aparece antes
    assert (page.rate, page.value_date) == (Decimal("875.6505"), date(2026, 10, 9))

    with pytest.raises(exchange_rate.RateError):
        exchange_rate.parse_dolarapi({"promedio": None})
    with pytest.raises(exchange_rate.RateError):
        exchange_rate.parse_dolarapi({"promedio": 0})
    with pytest.raises(exchange_rate.RateError):
        exchange_rate.parse_bcv("<html>cambió la página</html>")


def test_fetch_falls_back_to_bcv_page(monkeypatch):
    def api_down(url, verify=True):
        raise OSError("sin respuesta")

    monkeypatch.setattr(exchange_rate, "_get", api_down)
    monkeypatch.setattr(exchange_rate, "_get_bcv_html", lambda: BCV_SAMPLE)
    result = exchange_rate.fetch_rate(previous=Decimal("874.7321"))
    assert result.rate == Decimal("875.6505") and result.source == exchange_rate.BCV_SOURCE

    # Un valor muy distinto al anterior en la página (sin certificado verificado) se descarta
    with pytest.raises(exchange_rate.RateError):
        exchange_rate.fetch_rate(previous=Decimal("100"))

    monkeypatch.setattr(exchange_rate, "_get_bcv_html", lambda: (_ for _ in ()).throw(OSError("caído")))
    with pytest.raises(exchange_rate.RateError) as error:
        exchange_rate.fetch_rate()
    assert "conexión a internet" in str(error.value)


def test_automatic_rate_flow(admin, catalog, monkeypatch):
    settings = admin.get("/api/settings").json()
    assert settings["exchange_rate_mode"] == "bcv" and settings["exchange_rate"] is None

    monkeypatch.setattr(exchange_rate, "fetch_rate", fake_fetch())
    refreshed = admin.post("/api/settings/exchange-rate/refresh")
    assert refreshed.status_code == 200, refreshed.text
    data = refreshed.json()
    assert data["exchange_rate"] == 874.7321 and data["exchange_rate_date"] == "2026-10-08"
    assert data["exchange_rate_source"] == "BCV oficial (vía DolarApi.com)"
    assert data["exchange_rate_updated_at"] and data["exchange_rate_error"] is None

    # En modo automático no se puede escribir la tasa a mano
    assert admin.put("/api/settings", json={"exchange_rate": "1"}).json()["exchange_rate"] == 874.7321
    # La factura guarda la tasa vigente al momento de facturar
    created = bill(admin, [{"product_id": catalog["soda"]["product_id"], "quantity": 1}]).json()
    assert created["exchange_rate"] == 874.7321

    # Si falla la consulta, se conserva la última tasa y se muestra el error
    monkeypatch.setattr(exchange_rate, "fetch_rate", failing_fetch)
    failed = admin.post("/api/settings/exchange-rate/refresh")
    assert failed.status_code == 502 and "sin conexión de prueba" in failed.json()["detail"]
    kept = admin.get("/api/settings").json()
    assert kept["exchange_rate"] == 874.7321 and kept["exchange_rate_error"] == "sin conexión de prueba"

    # Al lograrlo de nuevo, el error desaparece
    monkeypatch.setattr(exchange_rate, "fetch_rate", fake_fetch("875.6505", date(2026, 10, 9)))
    assert admin.post("/api/settings/exchange-rate/refresh").json()["exchange_rate_error"] is None
    assert admin.get("/api/settings").json()["exchange_rate"] == 875.6505


def test_manual_rate_mode(admin, monkeypatch):
    monkeypatch.setattr(exchange_rate, "fetch_rate", fake_fetch())
    admin.post("/api/settings/exchange-rate/refresh")

    manual = admin.put("/api/settings", json={"exchange_rate_mode": "manual", "exchange_rate": "900.5"}).json()
    assert manual["exchange_rate_mode"] == "manual" and manual["exchange_rate"] == 900.5
    assert manual["exchange_rate_source"] == "Manual" and manual["exchange_rate_date"] is None
    # En modo manual no se consulta el BCV
    assert admin.post("/api/settings/exchange-rate/refresh").status_code == 400
    # Guardar sin cambiar la tasa no altera la fecha de actualización
    stamp = admin.get("/api/settings").json()["exchange_rate_updated_at"]
    assert admin.put("/api/settings", json={"exchange_rate": "900.5"}).json()["exchange_rate_updated_at"] == stamp
    # Se puede dejar vacía para no mostrar la segunda moneda
    assert admin.put("/api/settings", json={"exchange_rate": None}).json()["exchange_rate"] is None

    # Volver a automático consulta de inmediato
    monkeypatch.setattr(exchange_rate, "fetch_rate", fake_fetch("875.6505", date(2026, 10, 9)))
    auto = admin.put("/api/settings", json={"exchange_rate_mode": "bcv"}).json()
    assert auto["exchange_rate_mode"] == "bcv" and auto["exchange_rate"] == 875.6505


def test_switching_to_automatic_while_offline(admin, monkeypatch):
    admin.put("/api/settings", json={"exchange_rate_mode": "manual", "exchange_rate": "50"})
    monkeypatch.setattr(exchange_rate, "fetch_rate", failing_fetch)
    result = admin.put("/api/settings", json={"exchange_rate_mode": "bcv"})
    assert result.status_code == 200  # El cambio de modo se guarda aunque no haya internet
    assert result.json()["exchange_rate"] == 50 and result.json()["exchange_rate_error"]


def test_only_admin_can_refresh_rate(cashier):
    assert cashier.post("/api/settings/exchange-rate/refresh").status_code == 403


def test_concurrent_product_creation_gets_distinct_codes(admin, app):
    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    category = admin.post("/api/categories", json={"name": "Varios"}).json()["category_id"]

    def create(n):
        client = TestClient(app)
        client.headers["Authorization"] = admin.headers["Authorization"]
        return client.post("/api/products", json={"name": f"Producto {n}", "price": "1", "category_id": category})

    with ThreadPoolExecutor(max_workers=8) as pool:
        responses = list(pool.map(create, range(8)))

    assert [r.status_code for r in responses] == [201] * 8
    assert sorted(r.json()["code"] for r in responses) == [f"{n:06d}" for n in range(1, 9)]

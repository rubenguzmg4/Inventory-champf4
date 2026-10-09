from datetime import datetime
from zoneinfo import ZoneInfo

from conftest import ADMIN

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
    admin.put("/api/settings", json={"tax_rate": "16", "exchange_rate": "40.5"})
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

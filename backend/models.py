from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import deferred, relationship

from database import Base

# Todos los montos se guardan en la moneda principal (USD) con 2 decimales.
Money = Numeric(12, 2)


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False, default="cashier")  # 'admin' o 'cashier'
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relación con Facturas (Bills)
    bills = relationship("Bill", back_populates="user", foreign_keys="Bill.user_id")

    @property
    def display_name(self):
        return self.full_name or self.username


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relación con Productos
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"
    # Red de seguridad: la base de datos nunca acepta stock negativo
    __table_args__ = (CheckConstraint("stock >= 0", name="ck_products_stock_non_negative"),)

    product_id = Column(Integer, primary_key=True, index=True)
    # Código del producto: lo escribe el usuario (ej. código de barras) o se genera solo (000001, 000002...)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    brand = Column(String(100), nullable=True, index=True)  # Marca del producto
    description = Column(Text, nullable=True)
    price = Column(Money, nullable=False)  # Precio de venta en USD ($)
    cost = Column(Money, nullable=False, default=0)  # Último costo de compra
    stock = Column(Integer, nullable=False, default=0)
    min_stock = Column(Integer, nullable=False, default=0)  # Punto de reposición
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relaciones
    category = relationship("Category", back_populates="products")
    entries = relationship("Entry", back_populates="product")
    adjustments = relationship("StockAdjustment", back_populates="product")
    bill_details = relationship("BillDetail", back_populates="product")

    @property
    def category_name(self):
        return self.category.name if self.category else None

    @property
    def is_low_stock(self):
        return self.stock <= 0 or self.stock <= self.min_stock


class Client(Base):
    __tablename__ = "clients"

    # Número de Cédula de Identidad / RIF / Documento
    client_id = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    lastname = Column(String(100), nullable=False, default="")
    phone = Column(String(20), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relación con Facturas
    bills = relationship("Bill", back_populates="client")


class Entry(Base):
    """Entrada de mercancía (compra / reposición de stock)."""

    __tablename__ = "entries"

    entry_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    quantity = Column(Integer, nullable=False)  # Cantidad que ingresó
    unit_cost = Column(Money, nullable=True)
    supplier = Column(String(150), nullable=True)
    note = Column(Text, nullable=True)
    date = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relaciones
    product = relationship("Product", back_populates="entries")
    user = relationship("User")

    @property
    def product_name(self):
        return self.product.name

    @property
    def user_name(self):
        return self.user.display_name if self.user else None


class StockAdjustment(Base):
    """Corrección manual del stock (conteo físico, merma, daño, etc.)."""

    __tablename__ = "stock_adjustments"

    adjustment_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    reason = Column(Text, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="adjustments")
    user = relationship("User")


class Bill(Base):
    __tablename__ = "bills"

    bill_id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(20), ForeignKey("clients.client_id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    payment_method = Column(String(30), nullable=False, default="Efectivo")
    subtotal = Column(Money, nullable=False, default=0)
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0)  # Porcentaje, ej. 16.00
    tax_amount = Column(Money, nullable=False, default=0)
    total = Column(Money, nullable=False, default=0)
    exchange_rate = Column(Numeric(14, 4), nullable=True)  # Tasa de cambio usada al facturar
    note = Column(Text, nullable=True)
    status = Column(String(10), nullable=False, default="paid")  # 'paid' o 'void' (anulada)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    void_reason = Column(Text, nullable=True)

    # Relaciones
    client = relationship("Client", back_populates="bills")
    user = relationship("User", back_populates="bills", foreign_keys=[user_id])
    voided_by = relationship("User", foreign_keys=[voided_by_id])
    details = relationship(
        "BillDetail",
        back_populates="bill",
        cascade="all, delete-orphan",
        order_by="BillDetail.detail_id",
    )

    @property
    def client_name(self):
        return f"{self.client.name} {self.client.lastname}".strip()

    @property
    def cashier_name(self):
        return self.user.display_name

    @property
    def voided_by_name(self):
        return self.voided_by.display_name if self.voided_by else None

    @property
    def items_count(self):
        return sum(detail.quantity for detail in self.details)


class BillDetail(Base):
    __tablename__ = "bill_details"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_bill_details_quantity_positive"),)

    detail_id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.bill_id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False, index=True)
    # Copia del nombre y costo al momento de la venta, para que la factura no cambie
    # si luego se edita el producto.
    product_name = Column(String(150), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Money, nullable=False)
    unit_cost = Column(Money, nullable=True)
    subtotal = Column(Money, nullable=False)

    # Relaciones
    bill = relationship("Bill", back_populates="details")
    product = relationship("Product", back_populates="bill_details")


class Setting(Base):
    """Configuración del negocio. Siempre hay una sola fila (id = 1)."""

    __tablename__ = "settings"

    id = Column(Integer, primary_key=True)

    # Datos del negocio (aparecen en facturas y reportes)
    business_name = Column(String(150), nullable=False, default="Mi Negocio")
    tax_id = Column(String(50), nullable=True)  # RIF / NIT / RUC
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(120), nullable=True)
    invoice_footer = Column(Text, nullable=True, default="¡Gracias por su compra!")

    # Facturación
    currency_symbol = Column(String(5), nullable=False, default="$")
    tax_name = Column(String(20), nullable=False, default="IVA")
    tax_rate = Column(Numeric(5, 2), nullable=False, default=0)
    secondary_currency_symbol = Column(String(5), nullable=False, default="Bs.")
    exchange_rate = Column(Numeric(14, 4), nullable=True)  # Vacío = no mostrar segunda moneda
    # 'bcv' = se actualiza sola desde el Banco Central de Venezuela; 'manual' = la escribe el usuario
    exchange_rate_mode = Column(String(10), nullable=False, default="bcv", server_default="bcv")
    exchange_rate_source = Column(String(100), nullable=True)
    exchange_rate_date = Column(Date, nullable=True)  # Fecha valor de la tasa
    exchange_rate_updated_at = Column(DateTime(timezone=True), nullable=True)
    exchange_rate_error = Column(Text, nullable=True)  # Último error al consultar (se borra al lograrlo)
    payment_methods = Column(JSON, nullable=False, default=lambda: list(DEFAULT_PAYMENT_METHODS))
    receipt_format = Column(String(10), nullable=False, default="a4")  # 'a4' o 'ticket'

    # Reposición de stock: cuántos días de venta debe cubrir el pedido sugerido
    reorder_cover_days = Column(Integer, nullable=False, default=15)

    # Apariencia
    primary_color = Column(String(7), nullable=False, default="#228be6")
    sidebar_color = Column(String(7), nullable=True)  # Vacío = color neutro
    color_scheme = Column(String(10), nullable=False, default="light")  # light / dark / auto
    radius = Column(String(2), nullable=False, default="md")
    logo = deferred(Column(LargeBinary, nullable=True))
    logo_mime = Column(String(50), nullable=True)
    logo_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Interno: clave para firmar sesiones cuando no se define SECRET_KEY
    secret_key = Column(Text, nullable=True)

    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def logo_url(self):
        if not self.logo_mime:
            return None
        version = int(self.logo_updated_at.timestamp()) if self.logo_updated_at else 0
        return f"/api/settings/logo?v={version}"


DEFAULT_PAYMENT_METHODS = ["Efectivo", "Tarjeta de débito", "Pago móvil", "Transferencia"]

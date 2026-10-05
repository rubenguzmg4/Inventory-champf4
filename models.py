from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), default="cashier")  # 'cashier', 'admin', etc.

    # Relación con Facturas (Bills)
    bills = relationship("Bill", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)

    # Relación con Productos
    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)  # Monto en USD ($)
    stock = Column(Integer, default=0, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    description = Column(Text, nullable=True)

    # Relaciones
    category = relationship("Category", back_populates="products")
    entries = relationship("Entry", back_populates="product")
    bill_details = relationship("BillDetail", back_populates="product")


class Client(Base):
    __tablename__ = "clients"

    # Número de Cédula de Identidad / Documento
    client_id = Column(String(20), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    lastname = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)

    # Relación con Facturas
    bills = relationship("Bill", back_populates="client")


class Entry(Base):
    __tablename__ = "entries"

    entry_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    stock = Column(Integer, nullable=False)  # Cantidad que ingresó
    date = Column(DateTime, default=datetime.utcnow)

    # Relación con Producto
    product = relationship("Product", back_populates="entries")


class Bill(Base):
    __tablename__ = "bills"

    bill_id = Column(Integer, primary_key=True, index=True)
    client_id = Column(String(20), ForeignKey("clients.client_id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    total = Column(Numeric(10, 2), nullable=False, default=0.00)

    # Relaciones
    client = relationship("Client", back_populates="bills")
    user = relationship("User", back_populates="bills")
    details = relationship("BillDetail", back_populates="bill", cascade="all, delete-orphan")


class BillDetail(Base):
    __tablename__ = "bill_details"

    detail_id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.bill_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)

    # Relaciones
    bill = relationship("Bill", back_populates="details")
    product = relationship("Product", back_populates="bill_details")
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

# ==========================================
# 1. ESQUEMAS DE AUTENTICACIÓN Y USUARIO
# ==========================================
class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "cashier"  # 'cashier' o 'admin'

class UserResponse(BaseModel):
    user_id: int
    username: str
    role: str

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# ==========================================
# 2. ESQUEMAS DE CATEGORÍAS
# ==========================================
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 3. ESQUEMAS DE PRODUCTOS
# ==========================================
class ProductCreate(BaseModel):
    name: str
    price: Decimal
    stock: int = 0
    category_id: int
    description: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[Decimal] = None
    category_id: Optional[int] = None
    description: Optional[str] = None

class ProductResponse(BaseModel):
    product_id: int
    name: str
    price: Decimal
    stock: int
    category_id: int
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 4. ESQUEMAS DE ENTRADAS DE MERCANCÍA
# ==========================================
class EntryCreate(BaseModel):
    product_id: int
    stock: int  # Cantidad que llega al depósito

class EntryResponse(BaseModel):
    entry_id: int
    product_id: int
    stock: int
    date: datetime

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 5. ESQUEMAS DE CLIENTES
# ==========================================
class ClientCreate(BaseModel):
    client_id: str  # Cédula o Documento de identidad
    name: str
    lastname: str
    phone: Optional[str] = None
    address: Optional[str] = None

class ClientResponse(BaseModel):
    client_id: str
    name: str
    lastname: str
    phone: Optional[str] = None
    address: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 6. ESQUEMAS DE FACTURACIÓN (BILLS)
# ==========================================
class BillDetailCreate(BaseModel):
    product_id: int
    quantity: int

class BillCreate(BaseModel):
    client_id: str
    items: List[BillDetailCreate]

class BillDetailResponse(BaseModel):
    detail_id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)

class BillResponse(BaseModel):
    bill_id: int
    client_id: str
    user_id: int
    date: datetime
    total: Decimal
    details: List[BillDetailResponse]

    model_config = ConfigDict(from_attributes=True)
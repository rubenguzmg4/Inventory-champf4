from datetime import datetime
from decimal import Decimal
from typing import Annotated, List, Literal, Optional

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    field_validator,
)


# ==========================================
# 0. TIPOS REUTILIZABLES
# ==========================================
def _blank_to_none(value):
    """Convierte textos vacíos ("", "   ") en None."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def Required(max_length: int):
    """Texto obligatorio, sin espacios sobrantes."""
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)]


def Optional_(max_length: int | None = None):
    """Texto opcional: un texto vacío se guarda como None."""
    text = Annotated[str, StringConstraints(max_length=max_length)]
    return Annotated[Optional[text], BeforeValidator(_blank_to_none)]


# Montos de entrada: no negativos y con máximo 2 decimales
MoneyIn = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]
# Montos de salida: se envían como número (y no como texto) a la interfaz
MoneyOut = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
OptMoneyOut = Annotated[Optional[Decimal], PlainSerializer(lambda v: None if v is None else float(v), when_used="json")]

HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Username = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._-]+$")]
Role = Literal["admin", "cashier"]


def _check_password(value: str) -> str:
    if len(value) < 6:
        raise ValueError("La contraseña debe tener al menos 6 caracteres.")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("La contraseña es demasiado larga (máximo 72 caracteres).")
    return value


PasswordStr = Annotated[str, BeforeValidator(lambda v: _check_password(v) if isinstance(v, str) else v)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# 1. ESQUEMAS DE AUTENTICACIÓN Y USUARIO
# ==========================================
class SetupCreate(BaseModel):
    """Datos para la configuración inicial (primer administrador)."""
    business_name: Required(150)
    username: Username
    password: PasswordStr
    full_name: Optional_(100) = None


class UserCreate(BaseModel):
    username: Username
    password: PasswordStr
    full_name: Optional_(100) = None
    role: Role = "cashier"


class UserUpdate(BaseModel):
    full_name: Optional_(100) = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[PasswordStr] = None  # Solo si el administrador la restablece


class UserResponse(ORMModel):
    user_id: int
    username: str
    full_name: Optional[str] = None
    role: str
    is_active: bool


class PasswordChange(BaseModel):
    current_password: str
    new_password: PasswordStr


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ==========================================
# 2. ESQUEMAS DE CATEGORÍAS
# ==========================================
class CategoryCreate(BaseModel):
    name: Required(100)
    description: Optional_() = None


class CategoryResponse(ORMModel):
    category_id: int
    name: str
    description: Optional[str] = None
    product_count: int = 0


# ==========================================
# 3. ESQUEMAS DE PRODUCTOS
# ==========================================
class ProductCreate(BaseModel):
    code: Optional_(50) = None
    name: Required(150)
    description: Optional_() = None
    price: MoneyIn
    cost: MoneyIn = Decimal("0")
    stock: int = Field(0, ge=0)  # Stock inicial (queda registrado como entrada)
    min_stock: int = Field(0, ge=0)
    category_id: int


class ProductUpdate(BaseModel):
    """El stock no se edita aquí: cambia con entradas, ventas o ajustes."""
    code: Optional_(50) = None
    name: Optional[Required(150)] = None
    description: Optional_() = None
    price: Optional[MoneyIn] = None
    cost: Optional[MoneyIn] = None
    min_stock: Optional[int] = Field(None, ge=0)
    category_id: Optional[int] = None
    is_active: Optional[bool] = None


class ProductResponse(ORMModel):
    product_id: int
    code: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: MoneyOut
    cost: OptMoneyOut = None  # Solo visible para administradores
    stock: int
    min_stock: int
    category_id: int
    category_name: Optional[str] = None
    is_active: bool
    is_low_stock: bool


class ProductDeleteResult(BaseModel):
    deleted: bool
    detail: str


class StockAdjust(BaseModel):
    new_stock: int = Field(ge=0)
    reason: Required(500)


class ProductMovement(BaseModel):
    date: datetime
    type: Literal["entrada", "venta", "ajuste", "anulación"]
    quantity: int  # Positivo = suma al stock, negativo = resta
    reference: str
    user_name: Optional[str] = None


class ReplenishmentItem(BaseModel):
    product_id: int
    code: Optional[str] = None
    name: str
    category_name: Optional[str] = None
    stock: int
    min_stock: int
    cost: MoneyOut
    avg_daily_sales: float
    days_left: Optional[float] = None  # Días que alcanza el stock al ritmo actual
    suggested_quantity: int
    estimated_cost: MoneyOut
    status: Literal["out", "low", "soon"]  # agotado / bajo mínimo / por agotarse


# ==========================================
# 4. ESQUEMAS DE ENTRADAS DE MERCANCÍA
# ==========================================
class EntryCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)  # Cantidad que llega al depósito
    unit_cost: Optional[MoneyIn] = None
    supplier: Optional_(150) = None
    note: Optional_() = None


class EntryResponse(ORMModel):
    entry_id: int
    product_id: int
    product_name: str
    quantity: int
    unit_cost: OptMoneyOut = None
    supplier: Optional[str] = None
    note: Optional[str] = None
    date: datetime
    user_name: Optional[str] = None


# ==========================================
# 5. ESQUEMAS DE CLIENTES
# ==========================================
class ClientCreate(BaseModel):
    client_id: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=20)]
    name: Required(100)
    lastname: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    phone: Optional_(20) = None
    email: Optional_(120) = None
    address: Optional_() = None


class ClientUpdate(BaseModel):
    name: Optional[Required(100)] = None
    lastname: Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]] = None
    phone: Optional_(20) = None
    email: Optional_(120) = None
    address: Optional_() = None


class ClientResponse(ORMModel):
    client_id: str
    name: str
    lastname: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


# ==========================================
# 6. ESQUEMAS DE FACTURACIÓN (BILLS)
# ==========================================
class BillDetailCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)


class BillCreate(BaseModel):
    client_id: Annotated[str, StringConstraints(strip_whitespace=True, to_upper=True, min_length=1, max_length=20)]
    items: List[BillDetailCreate] = Field(min_length=1)
    payment_method: Required(30) = "Efectivo"
    note: Optional_() = None


class BillVoid(BaseModel):
    reason: Required(500)


class BillDetailResponse(ORMModel):
    detail_id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: MoneyOut
    subtotal: MoneyOut


class BillSummary(ORMModel):
    bill_id: int
    date: datetime
    client_id: str
    client_name: str
    cashier_name: str
    payment_method: str
    total: MoneyOut
    status: str
    items_count: int


class BillResponse(ORMModel):
    bill_id: int
    date: datetime
    client: ClientResponse
    cashier_name: str
    payment_method: str
    subtotal: MoneyOut
    tax_rate: MoneyOut
    tax_amount: MoneyOut
    total: MoneyOut
    exchange_rate: OptMoneyOut = None
    note: Optional[str] = None
    status: str
    voided_at: Optional[datetime] = None
    voided_by_name: Optional[str] = None
    void_reason: Optional[str] = None
    details: List[BillDetailResponse]


# ==========================================
# 7. ESQUEMAS DE CONFIGURACIÓN DEL NEGOCIO
# ==========================================
class PublicSettings(ORMModel):
    """Lo mínimo para pintar la pantalla de inicio de sesión (no requiere sesión)."""
    business_name: str
    primary_color: str
    sidebar_color: Optional[str] = None
    color_scheme: str
    radius: str
    logo_url: Optional[str] = None


class SettingsResponse(PublicSettings):
    tax_id: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    invoice_footer: Optional[str] = None
    currency_symbol: str
    tax_name: str
    tax_rate: MoneyOut
    secondary_currency_symbol: str
    exchange_rate: OptMoneyOut = None
    payment_methods: List[str]
    receipt_format: str
    reorder_cover_days: int


class SettingsUpdate(BaseModel):
    business_name: Optional[Required(150)] = None
    tax_id: Optional_(50) = None
    address: Optional_() = None
    phone: Optional_(50) = None
    email: Optional_(120) = None
    invoice_footer: Optional_() = None
    currency_symbol: Optional[Required(5)] = None
    tax_name: Optional[Required(20)] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100, max_digits=5, decimal_places=2)
    secondary_currency_symbol: Optional[Required(5)] = None
    exchange_rate: Optional[Decimal] = Field(None, gt=0, max_digits=14, decimal_places=4)
    payment_methods: Optional[List[Required(30)]] = Field(None, min_length=1)
    receipt_format: Optional[Literal["a4", "ticket"]] = None
    reorder_cover_days: Optional[int] = Field(None, ge=1, le=365)
    primary_color: Optional[HexColor] = None
    sidebar_color: Optional[HexColor] = None
    color_scheme: Optional[Literal["light", "dark", "auto"]] = None
    radius: Optional[Literal["xs", "sm", "md", "lg", "xl"]] = None

    @field_validator("payment_methods")
    @classmethod
    def unique_methods(cls, value):
        if value is None:
            return value
        seen = []
        for method in value:
            if method not in seen:
                seen.append(method)
        return seen

from datetime import datetime, timezone
from typing import Annotated, List, Literal, Optional

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer, StringConstraints

# Mirrors Numeric(10, 2) on the quantity/weight columns.
MAX_NUMERIC_10_2 = 99_999_999.99
# Smallest weight that survives rounding to two decimals.
MIN_WEIGHT = 0.01
MIN_PASSWORD_LENGTH = 8
# bcrypt only uses the first 72 bytes and newer versions reject longer input.
MAX_PASSWORD_BYTES = 72


def _to_utc_iso(value: datetime) -> str:
    # The database stores naive UTC; without an explicit "Z" browsers read the
    # value as local time and show it 5h30m early in India.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _check_password_bytes(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password must be at most {MAX_PASSWORD_BYTES} bytes")
    return value


UtcDatetime = Annotated[datetime, PlainSerializer(_to_utc_iso, return_type=str, when_used="json")]


def RequiredText(max_length: int, min_length: int = 1):
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length)]


def _blank_to_none(value: Optional[str]) -> Optional[str]:
    return value or None


def OptionalText(max_length: int):
    # The form sends "" for untouched fields; store those as NULL like omitted ones.
    return Annotated[
        Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]],
        AfterValidator(_blank_to_none),
    ]


Password = Annotated[
    str,
    StringConstraints(min_length=MIN_PASSWORD_LENGTH),
    AfterValidator(_check_password_bytes),
]
WeightUnit = Literal["kg", "ton"]


class VehicleEntryCreate(BaseModel):
    vehicle_number: RequiredText(20)
    project_name: OptionalText(100) = None
    subproject_name: OptionalText(100) = None
    driver_name: RequiredText(100)
    driver_phone: OptionalText(20) = None
    material_description: OptionalText(200) = None
    material_quantity: Optional[Annotated[float, Field(ge=0, le=MAX_NUMERIC_10_2)]] = None
    material_unit: OptionalText(20) = None
    purpose: OptionalText(50) = None
    reference_doc_number: OptionalText(50) = None
    supplier_transporter_name: OptionalText(100) = None


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_path: str
    uploaded_at: UtcDatetime


class VehicleEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    project_name: Optional[str] = None
    subproject_name: Optional[str] = None
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None
    entry_time: UtcDatetime
    exit_time: Optional[UtcDatetime] = None
    gross_weight: Optional[float] = None
    weight_unit: Optional[str] = None
    weighed_at: Optional[UtcDatetime] = None
    weighed_by_id: Optional[int] = None
    photos: List[PhotoOut] = []
    created_at: UtcDatetime


class WeightUpdate(BaseModel):
    gross_weight: Annotated[float, Field(ge=MIN_WEIGHT, le=MAX_NUMERIC_10_2)]
    weight_unit: Optional[WeightUnit] = None


Role = Literal["admin", "security_guard", "weighbridge_operator"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: RequiredText(50, min_length=3)
    password: Password
    full_name: RequiredText(100)
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[RequiredText(100)] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[Password] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: UtcDatetime

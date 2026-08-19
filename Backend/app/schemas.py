from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class VehicleEntryCreate(BaseModel):
    vehicle_number: str
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None


class VehicleEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_number: str
    driver_name: str
    driver_phone: Optional[str] = None
    material_description: Optional[str] = None
    material_quantity: Optional[float] = None
    material_unit: Optional[str] = None
    purpose: Optional[str] = None
    reference_doc_number: Optional[str] = None
    supplier_transporter_name: Optional[str] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    created_at: datetime


Role = Literal["admin", "security_guard"]


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Role] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str
    role: Role
    is_active: bool
    created_at: datetime

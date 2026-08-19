from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, Numeric, String
from sqlalchemy.sql import func

from app.database import Base


class VehicleEntry(Base):
    __tablename__ = "vehicle_entries"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_number = Column(String(20), nullable=False, index=True)
    driver_name = Column(String(100), nullable=False)
    driver_phone = Column(String(20), nullable=True)
    material_description = Column(String(200), nullable=True)
    material_quantity = Column(Numeric(10, 2), nullable=True)
    material_unit = Column(String(20), nullable=True)
    purpose = Column(String(50), nullable=True)
    reference_doc_number = Column(String(50), nullable=True)
    supplier_transporter_name = Column(String(100), nullable=True)
    entry_time = Column(DateTime, nullable=False, default=datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(60), nullable=False)
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

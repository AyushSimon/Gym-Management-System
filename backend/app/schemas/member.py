from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.validators import normalise_phone, validate_person_name


class MembershipStatus(str, Enum):
    active = "active"
    expired = "expired"
    upcoming = "upcoming"


class MemberPaymentStatus(str, Enum):
    paid = "paid"
    pending = "pending"


class MemberBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=80, examples=["Aarav Sharma"])
    age: int = Field(ge=12, le=100, examples=[27])
    phone: str = Field(examples=["9876543210"])
    plan_id: str = Field(pattern=r"^PLN-\d{3,}$", examples=["PLN-002"])
    start_date: date
    end_date: date | None = Field(
        default=None,
        description="Optional. Defaults to start_date + plan duration - 1 day (inclusive).",
    )
    payment_status: MemberPaymentStatus = MemberPaymentStatus.pending

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return validate_person_name(value)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalise_phone(value)

    @field_validator("start_date")
    @classmethod
    def _start_range(cls, value: date) -> date:
        if value < date(2000, 1, 1):
            raise ValueError("Start date is too far in the past")
        return value

    @model_validator(mode="after")
    def _date_order(self) -> "MemberBase":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        return self


class MemberCreate(MemberBase):
    pass


class MemberUpdate(MemberBase):
    pass


class RenewRequest(BaseModel):
    plan_id: str | None = Field(default=None, pattern=r"^PLN-\d{3,}$")
    start_date: date | None = None


class MembershipPeriod(BaseModel):
    plan_id: str
    plan_name: str
    start_date: date
    end_date: date


class MemberOut(BaseModel):
    id: str
    full_name: str
    age: int
    phone: str
    plan_id: str
    plan_name: str
    plan_duration_days: int
    start_date: date
    end_date: date
    status: MembershipStatus
    days_remaining: int
    expiring_soon: bool
    payment_status: MemberPaymentStatus
    created_at: datetime
    history: list[MembershipPeriod] = []

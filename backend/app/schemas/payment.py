from __future__ import annotations

from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from app.utils.validators import clean_text


class PaymentMethod(str, Enum):
    cash = "cash"
    upi = "upi"
    card = "card"
    bank_transfer = "bank_transfer"
    other = "other"


class PaymentStatus(str, Enum):
    paid = "paid"
    pending = "pending"
    failed = "failed"


class PaymentBase(BaseModel):
    member_id: str = Field(pattern=r"^M-\d{4,}$", examples=["M-0001"])
    amount: float = Field(gt=0, le=10_000_000, examples=[4000])
    payment_date: date
    method: PaymentMethod = PaymentMethod.cash
    status: PaymentStatus = PaymentStatus.paid
    notes: str = Field(default="", max_length=300)

    @field_validator("amount")
    @classmethod
    def _round_amount(cls, value: float) -> float:
        return round(value, 2)

    @field_validator("notes")
    @classmethod
    def _clean_notes(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("payment_date")
    @classmethod
    def _date_range(cls, value: date) -> date:
        if value < date(2000, 1, 1):
            raise ValueError("Payment date is too far in the past")
        return value


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(PaymentBase):
    pass


class PaymentOut(PaymentBase):
    id: str
    member_name: str
    created_at: datetime


class PaymentSummary(BaseModel):
    total_recorded: int
    total_paid_amount: float
    pending_count: int
    pending_amount: float
    failed_count: int
    paid_this_month: float


class MemberPaymentHistory(BaseModel):
    member_id: str
    member_name: str
    items: list[PaymentOut]
    total_paid: float
    total_pending: float

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.utils.validators import clean_text


class PlanBase(BaseModel):
    name: str = Field(min_length=2, max_length=60, examples=["Quarterly"])
    duration_days: int = Field(ge=1, le=3650, examples=[90])
    price: float = Field(ge=0, le=1_000_000, examples=[4000])
    description: str = Field(default="", max_length=300)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        value = clean_text(value)
        if len(value) < 2:
            raise ValueError("Plan name must be at least 2 characters")
        return value

    @field_validator("description")
    @classmethod
    def _clean_description(cls, value: str) -> str:
        return clean_text(value)

    @field_validator("price")
    @classmethod
    def _round_price(cls, value: float) -> float:
        return round(value, 2)


class PlanCreate(PlanBase):
    pass


class PlanUpdate(PlanBase):
    pass


class PlanOut(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    member_count: int = 0

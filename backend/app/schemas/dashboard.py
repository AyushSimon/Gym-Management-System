from __future__ import annotations

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_members: int
    active_members: int
    expired_members: int
    upcoming_members: int
    expiring_soon: int
    members_with_pending_payment: int
    pending_payments: int
    pending_amount: float
    total_collected: float
    total_plans: int


class DistributionItem(BaseModel):
    plan_id: str
    plan_name: str
    count: int


class GrowthPoint(BaseModel):
    month: str
    label: str
    new_members: int
    total_members: int

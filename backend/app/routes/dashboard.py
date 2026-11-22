from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.container import Container, get_container
from app.schemas.dashboard import DashboardStats, DistributionItem, GrowthPoint
from app.schemas.member import MemberOut
from app.schemas.payment import PaymentOut

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
def stats(c: Container = Depends(get_container)):
    return c.dashboard.stats()


@router.get("/recent-members", response_model=list[MemberOut])
def recent_members(limit: int = Query(5, ge=1, le=20), c: Container = Depends(get_container)):
    return c.dashboard.recent_members(limit)


@router.get("/recent-payments", response_model=list[PaymentOut])
def recent_payments(limit: int = Query(5, ge=1, le=20), c: Container = Depends(get_container)):
    return c.dashboard.recent_payments(limit)


@router.get("/membership-distribution", response_model=list[DistributionItem])
def membership_distribution(c: Container = Depends(get_container)):
    return c.dashboard.membership_distribution()


@router.get("/membership-growth", response_model=list[GrowthPoint])
def membership_growth(months: int = Query(6, ge=1, le=24), c: Container = Depends(get_container)):
    return c.dashboard.membership_growth(months)


@router.get("/expiring-memberships", response_model=list[MemberOut])
def expiring_memberships(
    days: int | None = Query(None, ge=0, le=90, description="Defaults to the configured warning window"),
    limit: int = Query(10, ge=1, le=50),
    c: Container = Depends(get_container),
):
    return c.dashboard.expiring_memberships(days, limit)

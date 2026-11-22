from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.container import Container, get_container
from app.schemas.common import Page
from app.schemas.member import (
    MemberCreate,
    MemberOut,
    MemberPaymentStatus,
    MemberUpdate,
    MembershipStatus,
    RenewRequest,
)

router = APIRouter(prefix="/api/members", tags=["Members"])

SortField = Literal[
    "id", "full_name", "age", "plan_name", "start_date", "end_date",
    "status", "payment_status", "created_at", "days_remaining",
]


@router.get("", response_model=Page[MemberOut], summary="List members with search, filters, sorting and pagination")
def list_members(
    q: str | None = Query(None, max_length=80, description="Matches member ID, name or phone number"),
    status_filter: MembershipStatus | None = Query(None, alias="status"),
    payment_status: MemberPaymentStatus | None = None,
    plan_id: str | None = None,
    expiring: bool = Query(False, description="Only active members expiring within the warning window"),
    sort_by: SortField = "created_at",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    c: Container = Depends(get_container),
):
    return c.members.list(
        q=q,
        status=status_filter.value if status_filter else None,
        payment_status=payment_status.value if payment_status else None,
        plan_id=plan_id,
        expiring=expiring,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


# Declared before /{member_id} so "search" is not captured as an id.
@router.get("/search", response_model=list[MemberOut], summary="Quick search by member ID, name or phone")
def search_members(
    q: str = Query(..., min_length=1, max_length=80),
    limit: int = Query(20, ge=1, le=50),
    c: Container = Depends(get_container),
):
    return c.members.search(q, limit)


@router.get("/{member_id}", response_model=MemberOut)
def get_member(member_id: str, c: Container = Depends(get_container)):
    return c.members.get(member_id)


@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(payload: MemberCreate, c: Container = Depends(get_container)):
    return c.members.create(payload)


@router.put("/{member_id}", response_model=MemberOut)
def update_member(member_id: str, payload: MemberUpdate, c: Container = Depends(get_container)):
    return c.members.update(member_id, payload)


@router.post("/{member_id}/renew", response_model=MemberOut, summary="Renew a membership")
def renew_member(member_id: str, payload: RenewRequest | None = None, c: Container = Depends(get_container)):
    return c.members.renew(member_id, payload or RenewRequest())


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: str, c: Container = Depends(get_container)):
    c.members.delete(member_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

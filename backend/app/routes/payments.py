from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response, status

from app.container import Container, get_container
from app.schemas.common import Page
from app.schemas.payment import (
    MemberPaymentHistory,
    PaymentCreate,
    PaymentMethod,
    PaymentOut,
    PaymentStatus,
    PaymentSummary,
    PaymentUpdate,
)

router = APIRouter(prefix="/api/payments", tags=["Payments"])

SortField = Literal["id", "member_name", "member_id", "amount", "payment_date", "status", "method", "created_at"]


@router.get("", response_model=Page[PaymentOut], summary="List payment records with filters and pagination")
def list_payments(
    q: str | None = Query(None, max_length=80, description="Matches payment ID, member ID, member name or notes"),
    status_filter: PaymentStatus | None = Query(None, alias="status"),
    method: PaymentMethod | None = None,
    member_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort_by: SortField = "payment_date",
    sort_order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    c: Container = Depends(get_container),
):
    return c.payments.list(
        q=q,
        status=status_filter.value if status_filter else None,
        method=method.value if method else None,
        member_id=member_id,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@router.get("/summary", response_model=PaymentSummary, summary="Totals for the payments page")
def payment_summary(c: Container = Depends(get_container)):
    return c.payments.summary()


@router.get("/member/{member_id}", response_model=MemberPaymentHistory, summary="Payment history of one member")
def member_payments(member_id: str, c: Container = Depends(get_container)):
    return c.payments.by_member(member_id)


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: str, c: Container = Depends(get_container)):
    return c.payments.get(payment_id)


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, c: Container = Depends(get_container)):
    return c.payments.create(payload)


@router.put("/{payment_id}", response_model=PaymentOut)
def update_payment(payment_id: str, payload: PaymentUpdate, c: Container = Depends(get_container)):
    return c.payments.update(payment_id, payload)


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: str, c: Container = Depends(get_container)):
    c.payments.delete(payment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

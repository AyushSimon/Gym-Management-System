from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Response, status

from app.container import Container, get_container
from app.schemas.membership import PlanCreate, PlanOut, PlanUpdate

router = APIRouter(prefix="/api/memberships", tags=["Membership plans"])


@router.get("", response_model=list[PlanOut])
def list_plans(
    q: str | None = Query(None, max_length=60),
    active: bool | None = None,
    c: Container = Depends(get_container),
):
    return c.plans.list(q=q, active=active)


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: str, c: Container = Depends(get_container)):
    return c.plans.get(plan_id)


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, c: Container = Depends(get_container)):
    return c.plans.create(payload)


@router.put("/{plan_id}", response_model=PlanOut)
def update_plan(plan_id: str, payload: PlanUpdate, c: Container = Depends(get_container)):
    return c.plans.update(plan_id, payload)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plan(plan_id: str, c: Container = Depends(get_container)):
    c.plans.delete(plan_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

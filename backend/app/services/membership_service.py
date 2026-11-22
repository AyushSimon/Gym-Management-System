from __future__ import annotations

from datetime import datetime, timezone

from app.errors import ConflictError, NotFoundError
from app.repositories.member_repository import MemberRepository
from app.repositories.membership_repository import MembershipRepository
from app.schemas.membership import PlanCreate, PlanUpdate


class MembershipService:
    def __init__(self, plans: MembershipRepository, members: MemberRepository):
        self.plans = plans
        self.members = members

    # ---------------------------------------------------------------- helpers
    def _member_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for member in self.members.list_all():
            counts[member["plan_id"]] = counts.get(member["plan_id"], 0) + 1
        return counts

    def _with_count(self, plan: dict, counts: dict[str, int]) -> dict:
        return {**plan, "member_count": counts.get(plan["id"], 0)}

    def _ensure_unique_name(self, name: str, exclude_id: str | None = None) -> None:
        for plan in self.plans.list_all():
            if plan["id"] != exclude_id and plan["name"].lower() == name.lower():
                raise ConflictError(f"A plan named '{plan['name']}' already exists")

    # ------------------------------------------------------------------- CRUD
    def list(self, q: str | None = None, active: bool | None = None) -> list[dict]:
        counts = self._member_counts()
        plans = self.plans.list_all()
        if q:
            needle = q.strip().lower()
            plans = [
                p for p in plans
                if needle in p["name"].lower()
                or needle in p["id"].lower()
                or needle in p.get("description", "").lower()
            ]
        if active is not None:
            plans = [p for p in plans if p["is_active"] == active]
        plans.sort(key=lambda p: (p["duration_days"], p["name"].lower()))
        return [self._with_count(p, counts) for p in plans]

    def get(self, plan_id: str) -> dict:
        plan = self.plans.get(plan_id)
        if plan is None:
            raise NotFoundError(f"Membership plan '{plan_id}' not found")
        return self._with_count(plan, self._member_counts())

    def create(self, payload: PlanCreate) -> dict:
        self._ensure_unique_name(payload.name)
        data = payload.model_dump()
        data["created_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        created = self.plans.create(data)
        return self._with_count(created, {})

    def update(self, plan_id: str, payload: PlanUpdate) -> dict:
        if self.plans.get(plan_id) is None:
            raise NotFoundError(f"Membership plan '{plan_id}' not found")
        self._ensure_unique_name(payload.name, exclude_id=plan_id)
        # Existing members keep their own plan snapshot (name and duration), so editing
        # a plan never rewrites historical membership information.
        updated = self.plans.update(plan_id, payload.model_dump())
        return self._with_count(updated, self._member_counts())

    def delete(self, plan_id: str) -> None:
        if self.plans.get(plan_id) is None:
            raise NotFoundError(f"Membership plan '{plan_id}' not found")
        in_use = self._member_counts().get(plan_id, 0)
        if in_use:
            raise ConflictError(
                f"Plan is assigned to {in_use} member{'s' if in_use != 1 else ''}. "
                "Reassign those members, or mark the plan inactive instead of deleting it."
            )
        self.plans.delete(plan_id)

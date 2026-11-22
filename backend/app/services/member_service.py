from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from app.errors import ConflictError, NotFoundError, ValidationFailed
from app.repositories.member_repository import MemberRepository
from app.repositories.membership_repository import MembershipRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.common import paginate
from app.schemas.member import MemberCreate, MemberUpdate, RenewRequest
from app.utils.validators import compute_end_date, days_remaining, membership_status

SORTABLE = {
    "id": lambda m: m["id"],
    "full_name": lambda m: m["full_name"].lower(),
    "age": lambda m: m["age"],
    "plan_name": lambda m: m["plan_name"].lower(),
    "start_date": lambda m: m["start_date"],
    "end_date": lambda m: m["end_date"],
    "status": lambda m: m["status"],
    "payment_status": lambda m: m["payment_status"],
    "created_at": lambda m: m["created_at"],
    "days_remaining": lambda m: m["days_remaining"],
}


class MemberService:
    """Membership rules

    * A membership is valid from ``start_date`` through ``end_date`` inclusive.
    * ``end_date`` defaults to ``start_date + duration_days - 1``.
    * Status is derived from dates only: ``upcoming`` (not started), ``active`` or
      ``expired``. It is independent of ``payment_status``, which staff set manually.
    * Each member stores a snapshot of the plan name and duration used for the current
      period, so later plan edits never rewrite history.
    * Moving to a different plan, or to a start date after the previous period ended,
      archives the previous period in ``history``. Correcting a typo in the same period
      overwrites it instead.
    """

    def __init__(
        self,
        members: MemberRepository,
        plans: MembershipRepository,
        payments: PaymentRepository,
        clock: Callable[[], date],
        warning_days: int = 7,
    ):
        self.members = members
        self.plans = plans
        self.payments = payments
        self.clock = clock
        self.warning_days = warning_days

    # --------------------------------------------------------------- presenting
    def present(self, record: dict, today: date | None = None) -> dict:
        today = today or self.clock()
        start = date.fromisoformat(record["start_date"])
        end = date.fromisoformat(record["end_date"])
        status = membership_status(start, end, today)
        remaining = days_remaining(end, today)
        return {
            "id": record["id"],
            "full_name": record["full_name"],
            "age": record["age"],
            "phone": record["phone"],
            "plan_id": record["plan_id"],
            "plan_name": record["plan_name"],
            "plan_duration_days": record["plan_duration_days"],
            "start_date": start,
            "end_date": end,
            "status": status,
            "days_remaining": remaining,
            "expiring_soon": status == "active" and remaining <= self.warning_days,
            "payment_status": record["payment_status"],
            "created_at": record["created_at"],
            "history": record.get("history", []),
        }

    def all_presented(self) -> list[dict]:
        today = self.clock()
        return [self.present(r, today) for r in self.members.list_all()]

    # ---------------------------------------------------------------- validation
    def _resolve_plan(self, plan_id: str) -> dict:
        plan = self.plans.get(plan_id)
        if plan is None:
            raise ValidationFailed(f"Membership plan '{plan_id}' does not exist")
        if not plan["is_active"]:
            raise ValidationFailed(f"Membership plan '{plan['name']}' is inactive and cannot be assigned")
        return plan

    def _check_start(self, start: date, today: date) -> None:
        if start > today + timedelta(days=365):
            raise ValidationFailed("Start date cannot be more than one year in the future")

    def _ensure_unique_phone(self, phone: str, exclude_id: str | None = None) -> None:
        for member in self.members.list_all():
            if member["id"] != exclude_id and member["phone"] == phone:
                raise ConflictError(f"{member['full_name']} ({member['id']}) already uses this contact number")

    def _payment_id_floor(self) -> int:
        """Never reuse an id that old payment records still point at."""
        highest = 0
        for payment in self.payments.list_all():
            match = re.search(r"(\d+)$", payment.get("member_id", ""))
            if match:
                highest = max(highest, int(match.group(1)))
        return highest

    @staticmethod
    def _period(record: dict) -> dict:
        return {
            "plan_id": record["plan_id"],
            "plan_name": record["plan_name"],
            "start_date": record["start_date"],
            "end_date": record["end_date"],
        }

    # --------------------------------------------------------------------- reads
    def get(self, member_id: str) -> dict:
        record = self.members.get(member_id)
        if record is None:
            raise NotFoundError(f"Member '{member_id}' not found")
        return self.present(record)

    @staticmethod
    def _matches(member: dict, needle: str) -> bool:
        needle = needle.strip().lower()
        if not needle:
            return True
        digits = re.sub(r"\D", "", needle)
        phone_digits = re.sub(r"\D", "", member["phone"])
        return (
            needle in member["id"].lower()
            or needle in member["full_name"].lower()
            or (bool(digits) and digits in phone_digits)
        )

    def search(self, q: str, limit: int = 20) -> list[dict]:
        found = [m for m in self.all_presented() if self._matches(m, q)]
        found.sort(key=lambda m: m["full_name"].lower())
        return found[:limit]

    def list(
        self,
        q: str | None = None,
        status: str | None = None,
        payment_status: str | None = None,
        plan_id: str | None = None,
        expiring: bool = False,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 10,
    ) -> dict:
        items = self.all_presented()
        if q:
            items = [m for m in items if self._matches(m, q)]
        if status:
            items = [m for m in items if m["status"] == status]
        if payment_status:
            items = [m for m in items if m["payment_status"] == payment_status]
        if plan_id:
            items = [m for m in items if m["plan_id"] == plan_id]
        if expiring:
            items = [m for m in items if m["expiring_soon"]]

        key = SORTABLE.get(sort_by, SORTABLE["created_at"])
        items.sort(key=key, reverse=(sort_order == "desc"))
        return paginate(items, page, page_size)

    # -------------------------------------------------------------------- writes
    def create(self, payload: MemberCreate) -> dict:
        today = self.clock()
        plan = self._resolve_plan(payload.plan_id)
        self._check_start(payload.start_date, today)
        self._ensure_unique_phone(payload.phone)

        end = payload.end_date or compute_end_date(payload.start_date, plan["duration_days"])
        record = {
            "full_name": payload.full_name,
            "age": payload.age,
            "phone": payload.phone,
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "plan_duration_days": plan["duration_days"],
            "start_date": payload.start_date.isoformat(),
            "end_date": end.isoformat(),
            "payment_status": payload.payment_status.value,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "history": [],
        }
        created = self.members.create(record, id_floor=self._payment_id_floor())
        return self.present(created, today)

    def update(self, member_id: str, payload: MemberUpdate) -> dict:
        today = self.clock()
        existing = self.members.get(member_id)
        if existing is None:
            raise NotFoundError(f"Member '{member_id}' not found")

        self._check_start(payload.start_date, today)
        self._ensure_unique_phone(payload.phone, exclude_id=member_id)

        plan_changed = payload.plan_id != existing["plan_id"]
        if plan_changed:
            plan = self._resolve_plan(payload.plan_id)
            plan_fields = {
                "plan_id": plan["id"],
                "plan_name": plan["name"],
                "plan_duration_days": plan["duration_days"],
            }
            duration = plan["duration_days"]
        else:
            plan_fields = {}
            duration = existing["plan_duration_days"]

        start_iso = payload.start_date.isoformat()
        start_changed = start_iso != existing["start_date"]

        if payload.end_date is not None:
            end = payload.end_date
        elif plan_changed or start_changed:
            end = compute_end_date(payload.start_date, duration)
        else:
            end = date.fromisoformat(existing["end_date"])

        history = list(existing.get("history", []))
        previous_end = date.fromisoformat(existing["end_date"])
        if plan_changed or payload.start_date > previous_end:
            history.append(self._period(existing))

        changes = {
            "full_name": payload.full_name,
            "age": payload.age,
            "phone": payload.phone,
            "start_date": start_iso,
            "end_date": end.isoformat(),
            "payment_status": payload.payment_status.value,
            "history": history,
            **plan_fields,
        }
        updated = self.members.update(member_id, changes)
        return self.present(updated, today)

    def renew(self, member_id: str, payload: RenewRequest) -> dict:
        today = self.clock()
        existing = self.members.get(member_id)
        if existing is None:
            raise NotFoundError(f"Member '{member_id}' not found")

        plan = self._resolve_plan(payload.plan_id or existing["plan_id"])
        previous_end = date.fromisoformat(existing["end_date"])
        if payload.start_date is not None:
            start = payload.start_date
        elif previous_end >= today:
            start = previous_end + timedelta(days=1)
        else:
            start = today
        self._check_start(start, today)

        history = list(existing.get("history", []))
        history.append(self._period(existing))
        changes = {
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "plan_duration_days": plan["duration_days"],
            "start_date": start.isoformat(),
            "end_date": compute_end_date(start, plan["duration_days"]).isoformat(),
            "payment_status": "pending",
            "history": history,
        }
        updated = self.members.update(member_id, changes)
        return self.present(updated, today)

    def delete(self, member_id: str) -> None:
        """Delete a member. Payment records are kept as history (they store the member name)."""
        if not self.members.delete(member_id):
            raise NotFoundError(f"Member '{member_id}' not found")

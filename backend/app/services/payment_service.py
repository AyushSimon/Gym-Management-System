from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Callable

from app.errors import NotFoundError, ValidationFailed
from app.repositories.member_repository import MemberRepository
from app.repositories.payment_repository import PaymentRepository
from app.schemas.common import paginate
from app.schemas.payment import PaymentCreate, PaymentUpdate

SORTABLE = {
    "id": lambda p: p["id"],
    "member_name": lambda p: p["member_name"].lower(),
    "member_id": lambda p: p["member_id"],
    "amount": lambda p: p["amount"],
    "payment_date": lambda p: (p["payment_date"], p["id"]),
    "status": lambda p: p["status"],
    "method": lambda p: p["method"],
    "created_at": lambda p: p["created_at"],
}


class PaymentService:
    """Payment *records* only. Nothing here talks to a payment gateway.

    Payment status is entered by staff. Recording or editing a payment never changes
    a member's own ``payment_status`` automatically.
    """

    def __init__(self, payments: PaymentRepository, members: MemberRepository, clock: Callable[[], date]):
        self.payments = payments
        self.members = members
        self.clock = clock

    # ---------------------------------------------------------------- helpers
    def _require_member(self, member_id: str) -> dict:
        member = self.members.get(member_id)
        if member is None:
            raise ValidationFailed(f"Member '{member_id}' does not exist")
        return member

    def _check_date(self, value: date) -> None:
        if value > self.clock():
            raise ValidationFailed("Payment date cannot be in the future")

    @staticmethod
    def _present(record: dict) -> dict:
        return {**record, "payment_date": date.fromisoformat(record["payment_date"])}

    @staticmethod
    def _matches(payment: dict, needle: str) -> bool:
        needle = needle.strip().lower()
        return (
            not needle
            or needle in payment["id"].lower()
            or needle in payment["member_id"].lower()
            or needle in payment["member_name"].lower()
            or needle in payment.get("notes", "").lower()
        )

    # ------------------------------------------------------------------ reads
    def get(self, payment_id: str) -> dict:
        record = self.payments.get(payment_id)
        if record is None:
            raise NotFoundError(f"Payment '{payment_id}' not found")
        return self._present(record)

    def list(
        self,
        q: str | None = None,
        status: str | None = None,
        method: str | None = None,
        member_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        sort_by: str = "payment_date",
        sort_order: str = "desc",
        page: int = 1,
        page_size: int = 10,
    ) -> dict:
        items = [self._present(r) for r in self.payments.list_all()]
        if q:
            items = [p for p in items if self._matches(p, q)]
        if status:
            items = [p for p in items if p["status"] == status]
        if method:
            items = [p for p in items if p["method"] == method]
        if member_id:
            items = [p for p in items if p["member_id"] == member_id]
        if date_from:
            items = [p for p in items if p["payment_date"] >= date_from]
        if date_to:
            items = [p for p in items if p["payment_date"] <= date_to]

        key = SORTABLE.get(sort_by, SORTABLE["payment_date"])
        items.sort(key=key, reverse=(sort_order == "desc"))
        return paginate(items, page, page_size)

    def by_member(self, member_id: str) -> dict:
        records = [self._present(r) for r in self.payments.list_all() if r["member_id"] == member_id]
        member = self.members.get(member_id)
        if member is None and not records:
            raise NotFoundError(f"Member '{member_id}' not found")
        records.sort(key=lambda p: (p["payment_date"], p["id"]), reverse=True)
        name = member["full_name"] if member else records[0]["member_name"]
        return {
            "member_id": member_id,
            "member_name": name,
            "items": records,
            "total_paid": round(sum(p["amount"] for p in records if p["status"] == "paid"), 2),
            "total_pending": round(sum(p["amount"] for p in records if p["status"] == "pending"), 2),
        }

    def summary(self) -> dict:
        records = self.payments.list_all()
        today = self.clock()
        month_prefix = f"{today.year:04d}-{today.month:02d}"
        paid = [r for r in records if r["status"] == "paid"]
        pending = [r for r in records if r["status"] == "pending"]
        return {
            "total_recorded": len(records),
            "total_paid_amount": round(sum(r["amount"] for r in paid), 2),
            "pending_count": len(pending),
            "pending_amount": round(sum(r["amount"] for r in pending), 2),
            "failed_count": sum(1 for r in records if r["status"] == "failed"),
            "paid_this_month": round(
                sum(r["amount"] for r in paid if r["payment_date"].startswith(month_prefix)), 2
            ),
        }

    # ----------------------------------------------------------------- writes
    def create(self, payload: PaymentCreate) -> dict:
        member = self._require_member(payload.member_id)
        self._check_date(payload.payment_date)
        record = {
            "member_id": member["id"],
            "member_name": member["full_name"],
            "amount": payload.amount,
            "payment_date": payload.payment_date.isoformat(),
            "method": payload.method.value,
            "status": payload.status.value,
            "notes": payload.notes,
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        return self._present(self.payments.create(record))

    def update(self, payment_id: str, payload: PaymentUpdate) -> dict:
        existing = self.payments.get(payment_id)
        if existing is None:
            raise NotFoundError(f"Payment '{payment_id}' not found")
        member = self._require_member(payload.member_id)
        self._check_date(payload.payment_date)
        changes = {
            "member_id": member["id"],
            "member_name": member["full_name"],
            "amount": payload.amount,
            "payment_date": payload.payment_date.isoformat(),
            "method": payload.method.value,
            "status": payload.status.value,
            "notes": payload.notes,
        }
        return self._present(self.payments.update(payment_id, changes))

    def delete(self, payment_id: str) -> None:
        if not self.payments.delete(payment_id):
            raise NotFoundError(f"Payment '{payment_id}' not found")

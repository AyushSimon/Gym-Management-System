from __future__ import annotations

from datetime import date, datetime
from typing import Callable

from app.repositories.membership_repository import MembershipRepository
from app.repositories.payment_repository import PaymentRepository
from app.services.member_service import MemberService
from app.utils.validators import last_n_months, month_end

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class DashboardService:
    def __init__(
        self,
        members: MemberService,
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

    def stats(self) -> dict:
        members = self.members.all_presented()
        payments = self.payments.list_all()
        pending = [p for p in payments if p["status"] == "pending"]
        paid = [p for p in payments if p["status"] == "paid"]
        return {
            "total_members": len(members),
            "active_members": sum(1 for m in members if m["status"] == "active"),
            "expired_members": sum(1 for m in members if m["status"] == "expired"),
            "upcoming_members": sum(1 for m in members if m["status"] == "upcoming"),
            "expiring_soon": sum(1 for m in members if m["expiring_soon"]),
            "members_with_pending_payment": sum(1 for m in members if m["payment_status"] == "pending"),
            "pending_payments": len(pending),
            "pending_amount": round(sum(p["amount"] for p in pending), 2),
            "total_collected": round(sum(p["amount"] for p in paid), 2),
            "total_plans": len(self.plans.list_all()),
        }

    def recent_members(self, limit: int = 5) -> list[dict]:
        members = self.members.all_presented()
        members.sort(key=lambda m: (m["created_at"], m["id"]), reverse=True)
        return members[:limit]

    def recent_payments(self, limit: int = 5) -> list[dict]:
        records = [
            {**p, "payment_date": date.fromisoformat(p["payment_date"])}
            for p in self.payments.list_all()
        ]
        records.sort(key=lambda p: (p["payment_date"], p["id"]), reverse=True)
        return records[:limit]

    def membership_distribution(self) -> list[dict]:
        """Members per plan, using the plan each member is currently on."""
        members = self.members.all_presented()
        plan_names = {p["id"]: p["name"] for p in self.plans.list_all()}
        counts: dict[str, int] = {}
        for member in members:
            counts[member["plan_id"]] = counts.get(member["plan_id"], 0) + 1
        result = [
            {"plan_id": pid, "plan_name": plan_names.get(pid, pid), "count": count}
            for pid, count in counts.items()
        ]
        result.sort(key=lambda item: item["count"], reverse=True)
        return result

    def membership_growth(self, months: int = 6) -> list[dict]:
        today = self.clock()
        created_dates: list[date] = []
        for record in self.members.members.list_all():
            try:
                created_dates.append(datetime.fromisoformat(record["created_at"]).date())
            except (KeyError, ValueError):
                continue

        points = []
        for year, month in last_n_months(today, months):
            end = month_end(year, month)
            points.append(
                {
                    "month": f"{year:04d}-{month:02d}",
                    "label": f"{MONTH_NAMES[month - 1]} {str(year)[2:]}",
                    "new_members": sum(1 for d in created_dates if d.year == year and d.month == month),
                    "total_members": sum(1 for d in created_dates if d <= end),
                }
            )
        return points

    def expiring_memberships(self, days: int | None = None, limit: int = 10) -> list[dict]:
        window = self.warning_days if days is None else days
        members = [
            m for m in self.members.all_presented()
            if m["status"] == "active" and m["days_remaining"] <= window
        ]
        members.sort(key=lambda m: m["days_remaining"])
        return members[:limit]

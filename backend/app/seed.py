"""Demo data, generated relative to today so the dashboard always looks alive.

Runs automatically on first start when every data file is empty and
GYM_SEED_DEMO_DATA is true. Run ``python -m app.seed --reset`` to regenerate.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, time, timedelta, timezone

from app.container import Container, get_container
from app.utils.validators import compute_end_date

PLANS = [
    ("Monthly", 30, 1500, "Full gym access for one month."),
    ("Quarterly", 90, 4000, "Three months of access with one free trainer consultation."),
    ("Half-Yearly", 180, 7000, "Six months of access and a fitness assessment."),
    ("Annual", 365, 12000, "Twelve months of access, best value for regulars."),
    ("Student Monthly", 30, 1000, "Discounted month for students with a valid ID."),
]

# name, age, phone, plan index, days ago membership started, member payment status
MEMBERS = [
    ("Aarav Sharma", 27, "9876500011", 1, 20, "paid"),
    ("Priya Das", 24, "9876500012", 0, 28, "paid"),
    ("Rohan Gupta", 31, "9876500013", 3, 95, "paid"),
    ("Ananya Roy", 22, "9876500014", 4, 8, "pending"),
    ("Kabir Singh", 35, "9876500015", 2, 120, "paid"),
    ("Isha Nath", 29, "9876500016", 0, 55, "paid"),
    ("Vikram Deb", 41, "9876500017", 1, 100, "pending"),
    ("Meera Paul", 26, "9876500018", 0, 33, "paid"),
    ("Arjun Chakraborty", 33, "9876500019", 3, 160, "paid"),
    ("Sneha Bhowmik", 23, "9876500020", 4, 2, "paid"),
    ("Dev Choudhury", 38, "9876500021", 1, 150, "paid"),
    ("Tanvi Reang", 21, "9876500022", 0, 14, "pending"),
    ("Rahul Debbarma", 30, "9876500023", 2, 40, "paid"),
    ("Neha Saha", 28, "9876500024", 0, -4, "pending"),
]

METHODS = ["upi", "cash", "card", "upi", "bank_transfer"]


def _stamp(day: date) -> str:
    return datetime.combine(day, time(10, 30), tzinfo=timezone.utc).isoformat(timespec="seconds")


def build(today: date) -> tuple[list[dict], list[dict], list[dict]]:
    plans = []
    for index, (name, days, price, description) in enumerate(PLANS, start=1):
        plans.append(
            {
                "id": f"PLN-{index:03d}",
                "name": name,
                "duration_days": days,
                "price": float(price),
                "description": description,
                "is_active": True,
                "created_at": _stamp(today - timedelta(days=210)),
            }
        )

    members, payments = [], []
    for index, (name, age, phone, plan_index, ago, pay_status) in enumerate(MEMBERS, start=1):
        plan = plans[plan_index]
        start = today - timedelta(days=ago)
        end = compute_end_date(start, plan["duration_days"])
        member_id = f"M-{index:04d}"
        members.append(
            {
                "id": member_id,
                "full_name": name,
                "age": age,
                "phone": phone,
                "plan_id": plan["id"],
                "plan_name": plan["name"],
                "plan_duration_days": plan["duration_days"],
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "payment_status": pay_status,
                "created_at": _stamp(min(start, today)),
                "history": [],
            }
        )
        payments.append(
            {
                "id": f"PAY-{len(payments) + 1:04d}",
                "member_id": member_id,
                "member_name": name,
                "amount": plan["price"],
                "payment_date": min(start, today).isoformat(),
                "method": METHODS[index % len(METHODS)],
                "status": "paid" if pay_status == "paid" else "pending",
                "notes": f"{plan['name']} plan",
                "created_at": _stamp(min(start, today)),
            }
        )
    # one failed attempt for the record
    payments.append(
        {
            "id": f"PAY-{len(payments) + 1:04d}",
            "member_id": "M-0004",
            "member_name": "Ananya Roy",
            "amount": 1000.0,
            "payment_date": (today - timedelta(days=7)).isoformat(),
            "method": "card",
            "status": "failed",
            "notes": "Card declined at counter, retry pending",
            "created_at": _stamp(today - timedelta(days=7)),
        }
    )
    return plans, members, payments


def seed_if_empty(container: Container) -> bool:
    repos = (container.plans_repo, container.members_repo, container.payments_repo)
    if any(repo.count() for repo in repos):
        return False
    reseed(container)
    return True


def reseed(container: Container) -> None:
    plans, members, payments = build(container.clock())
    container.plans_repo.replace_all(plans)
    container.members_repo.replace_all(members)
    container.payments_repo.replace_all(payments)


if __name__ == "__main__":
    target = get_container()
    if "--reset" in sys.argv:
        reseed(target)
        print("Demo data regenerated.")
    elif seed_if_empty(target):
        print("Demo data created.")
    else:
        print("Data already present. Use --reset to overwrite it with demo data.")

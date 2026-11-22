from app.repositories.base import JsonRepository


class MembershipRepository(JsonRepository):
    id_prefix = "PLN-"
    id_width = 3

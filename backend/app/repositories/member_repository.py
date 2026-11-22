from app.repositories.base import JsonRepository


class MemberRepository(JsonRepository):
    id_prefix = "M-"
    id_width = 4

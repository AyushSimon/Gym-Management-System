from app.repositories.base import JsonRepository


class PaymentRepository(JsonRepository):
    id_prefix = "PAY-"
    id_width = 4

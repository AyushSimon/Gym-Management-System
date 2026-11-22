"""Generic repository over a JSON file; subclasses only declare their id format."""
from __future__ import annotations

import re
from pathlib import Path

from app.utils.file_handler import JsonFileHandler, Record


class JsonRepository:
    id_field = "id"
    id_prefix = "X"
    id_width = 4

    def __init__(self, path: Path | str):
        self.handler = JsonFileHandler(path)
        self.handler.initialise()

    # ------------------------------------------------------------------ reads
    def list_all(self) -> list[Record]:
        return self.handler.read()

    def get(self, record_id: str) -> Record | None:
        for record in self.handler.read():
            if record.get(self.id_field) == record_id:
                return record
        return None

    def count(self) -> int:
        return len(self.handler.read())

    # ----------------------------------------------------------------- writes
    def _sequence(self, value: str) -> int:
        match = re.search(r"(\d+)$", value or "")
        return int(match.group(1)) if match else 0

    def next_id(self, records: list[Record], floor: int = 0) -> str:
        highest = max((self._sequence(r.get(self.id_field, "")) for r in records), default=0)
        number = max(highest, floor) + 1
        return f"{self.id_prefix}{number:0{self.id_width}d}"

    def create(self, data: Record, id_floor: int = 0) -> Record:
        """Assign a fresh id and append the record atomically."""
        with self.handler.lock:
            records = self.handler.read()
            record = {self.id_field: self.next_id(records, id_floor), **data}
            records.append(record)
            self.handler.write(records)
            return record

    def update(self, record_id: str, changes: Record) -> Record | None:
        return self.handler.update(self.id_field, record_id, changes)

    def delete(self, record_id: str) -> bool:
        return self.handler.delete(self.id_field, record_id)

    def replace_all(self, records: list[Record]) -> None:
        self.handler.write(records)

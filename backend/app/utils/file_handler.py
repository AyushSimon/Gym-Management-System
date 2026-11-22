"""Reusable, thread-safe JSON file storage with atomic writes.

Design notes
------------
* Every file holds a JSON array of objects.
* Writes go to a temporary file in the same directory, are flushed and fsynced,
  then swapped in with ``os.replace`` (atomic on POSIX and Windows).
* A missing or empty file is initialised to ``[]``.
* A corrupted file is moved aside as ``<name>.corrupt-<timestamp>`` and replaced
  by an empty array so the application keeps running; the incident is logged.
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger("gym.storage")

Record = dict[str, Any]

_registry_lock = threading.Lock()
_path_locks: dict[str, threading.RLock] = {}


def _lock_for(path: Path) -> threading.RLock:
    key = str(path.resolve())
    with _registry_lock:
        if key not in _path_locks:
            _path_locks[key] = threading.RLock()
        return _path_locks[key]


class StorageError(Exception):
    """Raised when data cannot be persisted or read safely."""


class JsonFileHandler:
    def __init__(self, path: Path | str):
        self.path = Path(path)
        self.lock = _lock_for(self.path)

    # ------------------------------------------------------------------ setup
    def initialise(self) -> None:
        with self.lock:
            if not self.path.exists():
                self.write([])

    # ------------------------------------------------------------------- read
    def read(self) -> list[Record]:
        with self.lock:
            if not self.path.exists():
                self.write([])
                return []
            try:
                text = self.path.read_text(encoding="utf-8")
            except OSError as exc:
                raise StorageError(f"Cannot read storage file {self.path.name}") from exc

            if not text.strip():
                return []

            try:
                data = json.loads(text)
                if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
                    raise ValueError("Storage root must be a list of objects")
                return data
            except (json.JSONDecodeError, ValueError):
                self._quarantine()
                return []

    def _quarantine(self) -> None:
        stamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup = self.path.with_name(f"{self.path.name}.corrupt-{stamp}")
        try:
            os.replace(self.path, backup)
            logger.warning("Corrupted storage %s moved to %s", self.path.name, backup.name)
        except OSError:
            logger.exception("Could not back up corrupted storage %s", self.path.name)
        self.write([])

    # ------------------------------------------------------------------ write
    def write(self, records: list[Record]) -> None:
        with self.lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp_name = tempfile.mkstemp(
                dir=self.path.parent, prefix=f"{self.path.name}.", suffix=".tmp"
            )
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as handle:
                    json.dump(records, handle, indent=2, ensure_ascii=False)
                    handle.flush()
                    os.fsync(handle.fileno())
                self._replace(tmp_name)
            except Exception as exc:
                try:
                    os.unlink(tmp_name)
                except OSError:
                    pass
                raise StorageError(f"Cannot write storage file {self.path.name}") from exc

    def _replace(self, tmp_name: str) -> None:
        # On Windows, os.replace can briefly fail if another process holds the file.
        for attempt in range(5):
            try:
                os.replace(tmp_name, self.path)
                return
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.05 * (attempt + 1))

    # ------------------------------------------------------------- operations
    def append(self, record: Record) -> Record:
        with self.lock:
            records = self.read()
            records.append(record)
            self.write(records)
            return record

    def update(self, id_field: str, record_id: str, changes: Record) -> Record | None:
        with self.lock:
            records = self.read()
            for index, record in enumerate(records):
                if record.get(id_field) == record_id:
                    records[index] = {**record, **changes}
                    self.write(records)
                    return records[index]
            return None

    def delete(self, id_field: str, record_id: str) -> bool:
        with self.lock:
            records = self.read()
            remaining = [r for r in records if r.get(id_field) != record_id]
            if len(remaining) == len(records):
                return False
            self.write(remaining)
            return True

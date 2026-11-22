import json
import threading

import pytest

from app.utils.file_handler import JsonFileHandler, StorageError
from app.repositories.member_repository import MemberRepository


def test_missing_file_is_created(tmp_path):
    path = tmp_path / "nested" / "things.json"
    handler = JsonFileHandler(path)
    assert handler.read() == []
    assert json.loads(path.read_text(encoding="utf-8")) == []


def test_empty_file_reads_as_empty_list(tmp_path):
    path = tmp_path / "empty.json"
    path.write_text("   \n", encoding="utf-8")
    assert JsonFileHandler(path).read() == []


def test_corrupted_file_is_quarantined_not_lost(tmp_path):
    path = tmp_path / "broken.json"
    path.write_text('{"not": "a list"', encoding="utf-8")
    handler = JsonFileHandler(path)
    assert handler.read() == []
    backups = list(tmp_path.glob("broken.json.corrupt-*"))
    assert len(backups) == 1
    assert backups[0].read_text(encoding="utf-8") == '{"not": "a list"'
    handler.append({"id": "1"})
    assert handler.read() == [{"id": "1"}]


def test_wrong_json_shape_is_treated_as_corrupt(tmp_path):
    path = tmp_path / "shape.json"
    path.write_text('{"id": 1}', encoding="utf-8")
    assert JsonFileHandler(path).read() == []
    assert list(tmp_path.glob("shape.json.corrupt-*"))


def test_append_update_delete(tmp_path):
    handler = JsonFileHandler(tmp_path / "items.json")
    handler.append({"id": "a", "v": 1})
    handler.append({"id": "b", "v": 2})
    assert handler.update("id", "a", {"v": 10})["v"] == 10
    assert handler.update("id", "zzz", {"v": 0}) is None
    assert handler.delete("id", "b") is True
    assert handler.delete("id", "b") is False
    assert handler.read() == [{"id": "a", "v": 10}]


def test_no_temp_files_left_behind(tmp_path):
    handler = JsonFileHandler(tmp_path / "clean.json")
    for index in range(5):
        handler.append({"id": str(index)})
    assert [p.name for p in tmp_path.iterdir()] == ["clean.json"]


def test_data_persists_across_repository_instances(tmp_path):
    path = tmp_path / "members.json"
    first = MemberRepository(path)
    created = first.create({"full_name": "Persist Me"})
    second = MemberRepository(path)  # simulates a server restart
    assert second.get(created["id"])["full_name"] == "Persist Me"


def test_concurrent_creates_get_unique_ids(tmp_path):
    repo = MemberRepository(tmp_path / "members.json")
    ids = []

    def worker():
        ids.append(repo.create({"x": 1})["id"])

    threads = [threading.Thread(target=worker) for _ in range(20)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(set(ids)) == 20
    assert repo.count() == 20


def test_unwritable_target_raises_storage_error(tmp_path):
    blocker = tmp_path / "blocker"
    blocker.write_text("i am a file", encoding="utf-8")
    handler = JsonFileHandler(blocker / "child.json")  # parent is a file, not a directory
    with pytest.raises((StorageError, OSError)):
        handler.write([])

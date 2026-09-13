from types import MethodType, SimpleNamespace
from urllib.parse import quote

import pytest

from src.clients.chunk_client import ChunkClient


def test_send_command_forwards_compact_response_query():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(command_timeout_seconds=2.5)
    captured = {}
    expected = object()

    def fake_post(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return expected

    client.post = MethodType(fake_post, client)

    result = client.send_command(
        "project",
        "world",
        {"type": "SetBlock"},
        include_command_log=False,
    )

    assert result is expected
    assert captured["path"] == "/projects/project/worlds/world/commands"
    assert captured["query"] == {"includeCommandLog": False}
    assert captured["json_body"] == {"type": "SetBlock"}
    assert captured["timeout_seconds"] == 2.5


def test_send_command_preserves_legacy_default_without_query():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(command_timeout_seconds=2.5)
    captured = {}

    def fake_post(self, path, **kwargs):
        captured.update(kwargs)
        return object()

    client.post = MethodType(fake_post, client)
    client.send_command("project", "world", {"type": "RemoveBlock"})

    assert captured["query"] is None


def test_compressed_object_batch_is_forwarded_once_with_a_scoped_long_timeout():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(command_timeout_seconds=2.5)
    calls = []
    def fake_post(self, path, **kwargs):
        calls.append({"path": path, **kwargs})
        return "sent"
    client.post = MethodType(fake_post, client)
    wrapper = {"type": "ObjectBatch", "transport": {"encoding": "gzip-base64",
        "schemaVersion": "vectoplan-command-transport.v1", "uncompressedBytes": 1024, "payload": "compressed-base64"}}
    assert client.send_command("project", "world", wrapper, include_command_log=False) == "sent"
    assert len(calls) == 1
    assert calls[0]["json_body"] == wrapper
    assert calls[0]["timeout_seconds"] == 120.0
    assert calls[0]["query"] == {"includeCommandLog": False}
    for invalid in ({**wrapper, "type": "SetBlock"},
                    {**wrapper, "transport": {**wrapper["transport"], "encoding": "other"}},
                    {**wrapper, "transport": {**wrapper["transport"], "uncompressedBytes": True}}):
        client.send_command("project", "world", invalid)
        assert calls[-1]["timeout_seconds"] == 2.5


def test_active_editor_dataset_uses_project_scoped_upstream_route():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    captured = {}
    expected = object()

    def fake_get(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return expected

    client.get = MethodType(fake_get, client)
    result = client.get_active_editor_dataset("project id", "world spawn")

    assert result is expected
    assert captured["path"] == "/projects/project%20id/worlds/world%20spawn/editor-datasets/active"
    assert captured["timeout_seconds"] == 3.0


def test_active_editor_dataset_chunk_forwards_only_integer_coordinates():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    captured = {}

    def fake_get(self, path, **kwargs):
        captured["path"] = path
        captured.update(kwargs)
        return object()

    client.get = MethodType(fake_get, client)
    client.get_active_editor_dataset_chunk(
        "project",
        "world",
        chunk_x=-2,
        chunk_y=0,
        chunk_z=7,
    )

    assert captured["path"].endswith("/editor-datasets/active/chunks")
    assert captured["query"] == {"chunkX": -2, "chunkY": 0, "chunkZ": 7}


def test_whole_lod2_building_read_uses_scoped_encoded_get_route():
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    captured = {}
    def fake_get(self, path, **kwargs):
        captured.update(path=path, **kwargs)
        return "read-result"
    client.get = MethodType(fake_get, client)
    assert client.get_lod2_building("project id", "world", "building id") == "read-result"
    assert captured["path"] == "/projects/project%20id/worlds/world/lod2-buildings/building%20id"
    assert captured["timeout_seconds"] == 3.0


@pytest.mark.parametrize("method, resource", [
    ("get_command_status", "commands"),
    ("get_planning_building", "planning-buildings"),
])
def test_recovery_reads_use_encoded_scoped_get_without_a_mutation_or_query(method, resource):
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    calls = []
    expected = object()

    def request(self, verb, path, **kwargs):
        calls.append((verb, path, kwargs))
        return expected

    client.request = MethodType(request, client)
    identity = "Höhe 1?projectId=other#fragment%"
    assert getattr(client, method)("project id", "world spawn", identity) is expected
    assert calls == [("GET",
        f"/projects/project%20id/worlds/world%20spawn/{resource}/{quote(identity, safe='')}",
        {"query": None, "headers": None, "timeout_seconds": 3.0})]


@pytest.mark.parametrize("method", ["get_command_status", "get_planning_building"])
@pytest.mark.parametrize("identity", ["", "../other", "other\\receipt"])
def test_recovery_read_rejects_path_escape_before_http(method, identity):
    client = ChunkClient.__new__(ChunkClient)
    client.config = SimpleNamespace(request_timeout_seconds=3.0)
    client.request = lambda *args, **kwargs: pytest.fail("invalid identity reached HTTP")
    with pytest.raises(ValueError):
        getattr(client, method)("project", "world", identity)

"""Encoded batches keep the ordinary authenticated Editor command proxy path."""
import base64
import gzip
import json
from types import SimpleNamespace

from flask import Flask
import pytest

from routes import chunk, access_context
from src.clients.chunk_client import ChunkClientResponse


def _wrapper():
    raw = json.dumps({"type": "ObjectBatch", "commands": [], "position": {"x": 0, "y": 0, "z": 0}}).encode()
    return {"type": "ObjectBatch", "transport": {"encoding": "gzip-base64",
        "schemaVersion": "vectoplan-command-transport.v1", "uncompressedBytes": len(raw),
        "payload": base64.b64encode(gzip.compress(raw)).decode()}}


@pytest.mark.parametrize("allowed", [True, False])
def test_proxy_keeps_wrapper_unchanged_and_requires_command_access(monkeypatch, allowed):
    app = Flask(__name__)
    app.config.update(TESTING=True, VECTOPLAN_EDITOR_CHUNK_PROXY_ENFORCE_PROJECT_ACCESS=True)
    app.register_blueprint(chunk.chunk_bp)
    seen = []
    def authorize(**kwargs):
        seen.append(("authorize", kwargs))
        if not allowed:
            raise access_context.EditorAccessError("command_forbidden", "command access denied")
    def send(project_id, world_id, payload, **kwargs):
        seen.append(("send", project_id, world_id, payload, kwargs))
        return SimpleNamespace(ok=True, status_code=200, data={"ok": True, "commandType": "ObjectBatch"})
    monkeypatch.setattr(access_context, "require_project_access", authorize)
    monkeypatch.setattr(chunk, "_get_chunk_client", lambda: SimpleNamespace(send_command=send))
    monkeypatch.setattr(chunk, "_chunk_service_enabled", lambda: True)
    wrapper = _wrapper()
    response = app.test_client().post("/editor/api/chunk/projects/project/worlds/world/commands?includeCommandLog=false", json=wrapper)
    assert seen[0] == ("authorize", {"project_id": "project", "world_id": "world", "capability": "command"})
    if allowed:
        assert response.status_code == 200
        assert seen[1] == ("send", "project", "world", wrapper, {"include_command_log": False})
        assert len(seen) == 2
    else:
        assert response.status_code == 403
        assert len(seen) == 1


def test_existing_proxy_request_size_limit_is_still_enforced(monkeypatch):
    app = Flask(__name__)
    app.config.update(TESTING=True, MAX_CONTENT_LENGTH=128)
    app.register_blueprint(chunk.chunk_bp)
    def forbidden_client():
        pytest.fail("oversized transport must never reach the upstream client")
    monkeypatch.setattr(chunk, "_get_chunk_client", forbidden_client)
    response = app.test_client().post("/editor/api/chunk/projects/project/worlds/world/commands", json=_wrapper())
    assert response.status_code in {400, 413}
    assert app.config["MAX_CONTENT_LENGTH"] == 128


RECOVERY_ROUTES = [
    ("commands", "get_command_status"),
    ("planning-buildings", "get_planning_building"),
]


def _recovery_app():
    app = Flask(__name__)
    app.config.update(TESTING=True, VECTOPLAN_EDITOR_CHUNK_PROXY_ENFORCE_PROJECT_ACCESS=True)
    app.register_blueprint(chunk.chunk_bp)
    return app


@pytest.mark.parametrize("resource, method", RECOVERY_ROUTES)
@pytest.mark.parametrize("status", [200, 202, 404, 409, 503])
def test_recovery_reads_require_view_and_preserve_upstream_status_payload(monkeypatch, resource, method, status):
    app = _recovery_app()
    calls = []
    payload = {"ok": status < 400, "state": "committed" if status == 200 else "pending",
        "commandId": "receipt id", "parentId": "parent id", "label": "Höhenmaß",
        "preservedCells": [{"x": -8, "y": 3, "z": 14}]}
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    def authorize(**kwargs):
        calls.append(("authorize", kwargs))

    def read(project_id, world_id, identity, **kwargs):
        calls.append(("upstream", project_id, world_id, identity, kwargs))
        return ChunkClientResponse(ok=status < 400, method="GET", path="/recovery-read",
            url="http://chunk.invalid/recovery-read", status_code=status, elapsed_ms=2.0,
            data=payload, raw_text=raw, request_id="upstream-recovery-request")

    monkeypatch.setattr(access_context, "require_project_access", authorize)
    monkeypatch.setattr(chunk, "_get_chunk_client", lambda: SimpleNamespace(**{method: read}))
    monkeypatch.setattr(chunk, "_chunk_service_enabled", lambda: True)
    # URL query parameters cannot replace the authorized path scope or turn a
    # recovery read into an includeCommandLog/mutation request upstream.
    response = app.test_client().get(
        f"/editor/api/chunk/projects/project/worlds/world/{resource}/object%20id"
        "?projectId=other&worldId=other&includeCommandLog=true")
    assert calls == [
        ("authorize", {"project_id": "project", "world_id": "world", "capability": "view"}),
        ("upstream", "project", "world", "object id", {}),
    ]
    assert response.status_code == status
    assert response.get_json() == payload
    assert response.headers["X-Vectoplan-Editor-Chunk-Operation"] == method
    assert response.headers["X-Vectoplan-Chunk-Upstream-Status"] == str(status)
    assert "no-store" in response.headers["Cache-Control"]


@pytest.mark.parametrize("resource, method", RECOVERY_ROUTES)
@pytest.mark.parametrize("scope, expected_code", [
    ("project", None),
    ("other-project", "project_context_mismatch"),
    ("other-world", "world_context_mismatch"),
    ("view-denied", "project_capability_denied"),
    ("anonymous", "authentication_required"),
])
def test_recovery_routes_apply_real_project_view_guard_before_client_creation(monkeypatch, resource, method, scope, expected_code):
    app = _recovery_app()
    calls = []

    def context(**kwargs):
        calls.append(("context", kwargs))
        if scope == "anonymous":
            raise access_context.EditorAccessError("authentication_required", "Missing access ticket", 401)
        # A view-only ticket must be enough for receipt/recovery reads; it must
        # not accidentally need the command capability used by POST /commands.
        return SimpleNamespace(chunk_project_id="project", world_id="world", can_view=scope != "view-denied",
            can_edit=False, can_manage=False, can_command=False, can_materialize=False, read_only=True)

    def client():
        calls.append(("client",))
        return SimpleNamespace(**{method: lambda *args: SimpleNamespace(ok=True, status_code=200, data={"ok": True})})

    monkeypatch.setattr(access_context, "get_request_access_context", context)
    monkeypatch.setattr(chunk, "_get_chunk_client", client)
    monkeypatch.setattr(chunk, "_chunk_service_enabled", lambda: True)
    project = "other-project" if scope == "other-project" else "project"
    world = "other-world" if scope == "other-world" else "world"
    response = app.test_client().get(f"/editor/api/chunk/projects/{project}/worlds/{world}/{resource}/id")
    assert calls[0] == ("context", {"required": True, "project_id_hint": project})
    if expected_code:
        assert response.status_code == (401 if scope == "anonymous" else 403)
        assert response.get_json()["error"]["code"] == expected_code
        assert len(calls) == 1, "denied reads must not even construct an upstream client"
    else:
        assert response.status_code == 200
        assert calls[1:] == [("client",)]

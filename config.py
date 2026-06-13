# services/vectoplan-editor/config.py
"""
Zentrale Konfiguration für den Microservice `vectoplan-editor`.

Diese Datei ist bewusst vorausschauend aufgebaut, weil der Editor aktuell
mehrere Integrationspfade gleichzeitig trägt:

1. Die aktive Browser-/Builder-Runtime unter:

       services/vectoplan-editor/src/frontend

2. Den bestehenden Remote-Chunk-Service-Pfad:

       Browser
         -> /editor/api/chunk
         -> vectoplan-editor Backend-Proxy
         -> vectoplan-chunk

3. Den neuen Library-/Inventory-Pfad:

       Browser
         -> /editor/api/inventory
         -> vectoplan-editor Backend
         -> src.inventory
         -> src.clients.library_client
         -> vectoplan-library

Zentrale Aufgaben dieser Datei:

- robuste ENV-Verarbeitung mit Defaults
- zentrale Pfade für Backend, Templates, Static Assets und Frontend
- Konfiguration für Vite-Build-Ausgabe unter static/editor
- Konfiguration für Editor-Bootstrap
- Konfiguration für den Chunk-Service-Proxy unter /editor/api/chunk
- Konfiguration für den Library-Service-Client
- Konfiguration für das Editor-Inventory unter /editor/api/inventory
- klare Trennung zwischen interner Service-URL und browserseitiger Proxy-URL
- Backwards-Compatible Aliases für ältere ENV-Namen
- robuste Settings für Runtime, UI, Hotbar, Scene, Debug und Health

Wichtige Invarianten:

- Der Browser spricht niemals direkt mit http://vectoplan-chunk:5000.
- Der Browser spricht niemals direkt mit http://vectoplan-library:5000.
- Der Browser spricht für Chunks mit /editor/api/chunk.
- Der Browser spricht für Inventory mit /editor/api/inventory.
- Das Editor-Backend proxyt/integriert serverintern zu anderen Services.
- Das Editor-Inventar soll aus vectoplan-library kommen.
- Chunk-placeable-blocks sind nur noch Debug-/Legacy-Fallback und standardmäßig
  keine fachliche Inventory-Wahrheit.
- Diese Datei enthält keine Business-Logik.
- Diese Datei enthält keine HTTP-Proxy-Implementierung.
- Diese Datei enthält keine Chunk- oder Library-Fachlogik.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Final


# =============================================================================
# Konstanten
# =============================================================================

_TRUE_VALUES: Final[set[str]] = {"1", "true", "t", "yes", "y", "on", "enabled"}
_FALSE_VALUES: Final[set[str]] = {"0", "false", "f", "no", "n", "off", "disabled"}

_DEFAULT_APP_NAME: Final[str] = "vectoplan-editor"
_DEFAULT_APP_DISPLAY_NAME: Final[str] = "VECTOPLAN Editor"

_DEFAULT_EDITOR_ROUTE_PATH: Final[str] = "/editor"
_DEFAULT_EDITOR_TEMPLATE_NAME: Final[str] = "editor/index.html"

_DEFAULT_STATIC_EDITOR_URL_PREFIX: Final[str] = "/static/editor"
_DEFAULT_STATIC_EDITOR_MANIFEST_NAME: Final[str] = "manifest.json"
_DEFAULT_VITE_ENTRYPOINT: Final[str] = "main.ts"

_DEFAULT_EDITOR_TEMPLATE_MODE: Final[str] = "chunk_service_viewport"
_DEFAULT_EDITOR_RUNTIME_MODE: Final[str] = "remote_chunk_service"
_DEFAULT_EDITOR_WORLD_MODE: Final[str] = "chunk_service"
_DEFAULT_EDITOR_SOURCE_MODE: Final[str] = "chunk-service"
_DEFAULT_EDITOR_BUILD_MODE: Final[str] = "development"
_DEFAULT_EDITOR_BUILD_VERSION: Final[str] = "dev"

# -----------------------------------------------------------------------------
# Chunk-Service Defaults
# -----------------------------------------------------------------------------

_DEFAULT_CHUNK_SERVICE_ENABLED: Final[bool] = True
_DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL: Final[str] = "http://vectoplan-chunk:5000"
_DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL: Final[str] = "/editor/api/chunk"
_DEFAULT_CHUNK_SERVICE_API_PREFIX: Final[str] = "/editor/api/chunk"
_DEFAULT_CHUNK_SERVICE_PROJECT_ID: Final[str] = "dev-project"
_DEFAULT_CHUNK_SERVICE_WORLD_ID: Final[str] = "world_spawn"
_DEFAULT_CHUNK_SERVICE_SOURCE_KIND: Final[str] = "vectoplan-chunk"
_DEFAULT_CHUNK_SERVICE_MODE: Final[str] = "editor-proxy"
_DEFAULT_CHUNK_SERVICE_REGISTRY_ID: Final[str] = "debug-blocks"
_DEFAULT_CHUNK_SERVICE_REGISTRY_VERSION: Final[str] = "1"

_DEFAULT_CHUNK_REQUEST_TIMEOUT_MS: Final[int] = 10_000
_DEFAULT_CHUNK_COMMAND_TIMEOUT_MS: Final[int] = 15_000
_DEFAULT_CHUNK_BATCH_TIMEOUT_MS: Final[int] = 20_000
_DEFAULT_CHUNK_STATUS_TIMEOUT_MS: Final[int] = 5_000
_DEFAULT_CHUNK_MAX_BATCH_CHUNKS: Final[int] = 256
_DEFAULT_CHUNK_MAX_RESPONSE_BYTES: Final[int] = 20 * 1024 * 1024

# Diese Debug-Blöcke bleiben nur als Legacy-/Debug-Konfiguration erhalten.
# Das produktive Editor-Inventar darf daraus standardmäßig NICHT gebaut werden.
_DEFAULT_PLACEABLE_BLOCKS: Final[tuple[dict[str, Any], ...]] = (
    {
        "blockTypeId": "debug_grass",
        "label": "Debug Grass",
        "cellValue": 1,
        "paletteIndex": 0,
        "solid": True,
        "placeable": True,
        "breakable": True,
        "debugOnly": True,
    },
    {
        "blockTypeId": "debug_dirt",
        "label": "Debug Dirt",
        "cellValue": 2,
        "paletteIndex": 1,
        "solid": True,
        "placeable": True,
        "breakable": True,
        "debugOnly": True,
    },
)

# -----------------------------------------------------------------------------
# Library-Service Defaults
# -----------------------------------------------------------------------------

_DEFAULT_LIBRARY_SERVICE_ENABLED: Final[bool] = True
_DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL: Final[str] = "http://vectoplan-library:5000"
_DEFAULT_LIBRARY_SERVICE_API_PREFIX: Final[str] = "/api/v1/vplib/library"
_DEFAULT_LIBRARY_SERVICE_SOURCE: Final[str] = "db"

_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS: Final[int] = 5_000
_DEFAULT_LIBRARY_STATUS_TIMEOUT_MS: Final[int] = 3_000
_DEFAULT_LIBRARY_MAX_RESPONSE_BYTES: Final[int] = 10 * 1024 * 1024
_DEFAULT_LIBRARY_CLIENT_CACHE_TTL_SECONDS: Final[float] = 5.0
_DEFAULT_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS: Final[float] = 60.0
_DEFAULT_LIBRARY_CLIENT_ALLOW_STALE_CACHE: Final[bool] = True
_DEFAULT_LIBRARY_CLIENT_USER_AGENT: Final[str] = "vectoplan-editor-library-client/0.1"

# Browserseitig nicht direkt vectoplan-library:
# Diese Werte sind Routen des Editor-Service.
_DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL: Final[str] = "/editor/api/library"
_DEFAULT_EDITOR_INVENTORY_ROUTE_PATH: Final[str] = "/editor/api/inventory"
_DEFAULT_EDITOR_INVENTORY_SOURCE: Final[str] = "library"
_DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE: Final[int] = 9
_DEFAULT_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT: Final[int] = 0
_DEFAULT_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT: Final[int] = 32

# Harte neue Regel:
# Chunk-placeable-blocks sind nicht mehr fachliche Hotbar-Wahrheit.
_DEFAULT_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK: Final[bool] = False
_DEFAULT_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_ICON_ONLY: Final[bool] = False
_DEFAULT_EDITOR_INVENTORY_ALLOW_PLACE_ACTION: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_ALLOW_BREAK_ACTION: Final[bool] = True
_DEFAULT_EDITOR_INVENTORY_SCROLL_WRAP: Final[bool] = True

# -----------------------------------------------------------------------------
# UI Defaults
# -----------------------------------------------------------------------------

_DEFAULT_ALLOWED_ORIGINS: Final[tuple[str, ...]] = ("*",)

_DEFAULT_EDITOR_STATUS_INITIAL: Final[str] = "Initialisierung..."
_DEFAULT_EDITOR_STATUS_LOADING: Final[str] = "Editor wird geladen..."
_DEFAULT_EDITOR_STATUS_READY: Final[str] = "Editor bereit"
_DEFAULT_EDITOR_STATUS_ERROR: Final[str] = "Editor konnte nicht gestartet werden"

_DEFAULT_POINTER_LOCK_TITLE: Final[str] = "First-Person-Modus"
_DEFAULT_POINTER_LOCK_MESSAGE: Final[str] = (
    "Klicke in den Viewport, um die Maus zu sperren und dich im Raum zu bewegen."
)
_DEFAULT_POINTER_LOCK_HINT: Final[str] = (
    "W A S D bewegen · Maus schauen · Linksklick setzen · Rechtsklick entfernen · ESC löst den Mausfang."
)


# =============================================================================
# Robuste ENV-Helfer
# =============================================================================

def _safe_getenv(name: str) -> str | None:
    try:
        return os.getenv(name)
    except Exception:
        return None


def _normalize_text(value: Any) -> str | None:
    if value is None:
        return None

    try:
        normalized = str(value).strip()
    except Exception:
        return None

    return normalized or None


def _read_str_env(name: str, default: str) -> str:
    value = _normalize_text(_safe_getenv(name))
    return value if value is not None else default


def _read_optional_str_env(name: str, default: str | None = None) -> str | None:
    value = _normalize_text(_safe_getenv(name))
    return value if value is not None else default


def _read_first_str_env(names: tuple[str, ...], default: str) -> str:
    for name in names:
        value = _normalize_text(_safe_getenv(name))
        if value is not None:
            return value

    return default


def _read_bool_env(name: str, default: bool = False) -> bool:
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        return default

    lowered = raw_value.lower()

    if lowered in _TRUE_VALUES:
        return True

    if lowered in _FALSE_VALUES:
        return False

    return default


def _read_first_bool_env(names: tuple[str, ...], default: bool = False) -> bool:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        lowered = raw_value.lower()

        if lowered in _TRUE_VALUES:
            return True

        if lowered in _FALSE_VALUES:
            return False

    return default


def _read_int_env(
    name: str,
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        value = default
    else:
        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_first_int_env(
    names: tuple[str, ...],
    default: int,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        try:
            value = int(raw_value)
        except (TypeError, ValueError):
            continue

        if minimum is not None:
            value = max(minimum, value)

        if maximum is not None:
            value = min(maximum, value)

        return value

    value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_float_env(
    name: str,
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        value = default
    else:
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_first_float_env(
    names: tuple[str, ...],
    default: float,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    for name in names:
        raw_value = _normalize_text(_safe_getenv(name))
        if raw_value is None:
            continue

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        if minimum is not None:
            value = max(minimum, value)

        if maximum is not None:
            value = min(maximum, value)

        return value

    value = default

    if minimum is not None:
        value = max(minimum, value)

    if maximum is not None:
        value = min(maximum, value)

    return value


def _read_csv_env(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw_value = _normalize_text(_safe_getenv(name))

    if raw_value is None:
        return default

    try:
        values = tuple(part.strip() for part in raw_value.split(",") if part.strip())
    except Exception:
        return default

    return values or default


def _read_json_env(name: str, default: Any) -> Any:
    raw_value = _normalize_text(_safe_getenv(name))
    if raw_value is None:
        return default

    try:
        return json.loads(raw_value)
    except Exception:
        return default


def _resolve_service_root() -> Path:
    try:
        return Path(__file__).resolve().parent
    except Exception:
        return Path(".").resolve()


SERVICE_ROOT: Final[Path] = _resolve_service_root()


def _build_path(*parts: str) -> Path:
    try:
        return SERVICE_ROOT.joinpath(*parts)
    except Exception:
        return SERVICE_ROOT


def _normalize_route_path(value: str, default: str) -> str:
    raw_value = _normalize_text(value) or default

    try:
        normalized = raw_value.strip()
        if not normalized:
            normalized = default

        if not normalized.startswith("/"):
            normalized = f"/{normalized}"

        if len(normalized) > 1:
            normalized = normalized.rstrip("/")

        return normalized
    except Exception:
        return default


def _normalize_url(value: str, default: str) -> str:
    raw_value = _normalize_text(value) or default

    try:
        normalized = raw_value.rstrip("/")
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
    except Exception:
        pass

    return default.rstrip("/")


def _normalize_api_prefix(value: str, default: str) -> str:
    raw_value = _normalize_text(value) or default

    try:
        normalized = raw_value.strip()
        if not normalized:
            normalized = default

        if not normalized.startswith("/"):
            normalized = f"/{normalized}"

        if len(normalized) > 1:
            normalized = normalized.rstrip("/")

        return normalized
    except Exception:
        return default


def _join_route_path(*parts: str) -> str:
    cleaned: list[str] = []

    for part in parts:
        value = _normalize_text(part)
        if value is None:
            continue
        cleaned.append(value.strip("/"))

    if not cleaned:
        return "/"

    return "/" + "/".join(cleaned)


def _as_public_static_url(prefix: str, file_path: str) -> str:
    normalized_prefix = _normalize_route_path(prefix, _DEFAULT_STATIC_EDITOR_URL_PREFIX)
    normalized_file = (_normalize_text(file_path) or "").lstrip("/")
    return _join_route_path(normalized_prefix, normalized_file)


def _seconds_from_ms(milliseconds: int, default_seconds: float) -> float:
    try:
        return max(0.1, float(milliseconds) / 1000.0)
    except Exception:
        return default_seconds


# =============================================================================
# Cache-Helfer
# =============================================================================

@lru_cache(maxsize=32)
def _cached_chunk_route_hints(
    api_base_url: str,
    project_id: str,
    world_id: str,
) -> dict[str, str]:
    prefix = _normalize_route_path(api_base_url, _DEFAULT_CHUNK_SERVICE_API_PREFIX)
    project_base = _join_route_path(prefix, "projects", project_id)
    world_base = _join_route_path(project_base, "worlds", world_id)

    return {
        "apiBaseUrl": prefix,
        "status": _join_route_path(prefix, "_status"),
        "testConnection": _join_route_path(prefix, "_test", "connection"),
        "placeableBlocks": _join_route_path(prefix, "placeable-blocks"),
        "projects": _join_route_path(prefix, "projects"),
        "project": project_base,
        "projectBootstrap": _join_route_path(project_base, "bootstrap"),
        "worlds": _join_route_path(project_base, "worlds"),
        "world": world_base,
        "blocks": _join_route_path(world_base, "blocks"),
        "chunk": _join_route_path(world_base, "chunks"),
        "chunks": _join_route_path(world_base, "chunks"),
        "chunksBatch": _join_route_path(world_base, "chunks", "batch"),
        "commands": _join_route_path(world_base, "commands"),
    }


@lru_cache(maxsize=32)
def _cached_library_route_hints(
    editor_library_browser_base_url: str,
    editor_inventory_route_path: str,
) -> dict[str, str]:
    browser_base = _normalize_route_path(
        editor_library_browser_base_url,
        _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
    )
    inventory_route = _normalize_route_path(
        editor_inventory_route_path,
        _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
    )

    return {
        "browserBaseUrl": browser_base,
        "inventory": inventory_route,
        "status": _join_route_path(browser_base, "_status"),
        "health": _join_route_path(browser_base, "health"),
        "dbHealth": _join_route_path(browser_base, "db", "health"),
        "publicationStatus": _join_route_path(browser_base, "publication-status"),
        "blocks": _join_route_path(browser_base, "blocks"),
        "tree": _join_route_path(browser_base, "tree"),
    }


@lru_cache(maxsize=32)
def _cached_static_paths(
    static_editor_url_prefix: str,
    manifest_name: str,
) -> dict[str, str]:
    prefix = _normalize_route_path(static_editor_url_prefix, _DEFAULT_STATIC_EDITOR_URL_PREFIX)
    manifest = _normalize_text(manifest_name) or _DEFAULT_STATIC_EDITOR_MANIFEST_NAME

    return {
        "staticEditorUrlPrefix": prefix,
        "manifestUrl": _as_public_static_url(prefix, manifest),
    }


@lru_cache(maxsize=32)
def _cached_default_placeable_blocks() -> tuple[dict[str, Any], ...]:
    return tuple(dict(block) for block in _DEFAULT_PLACEABLE_BLOCKS)


# =============================================================================
# Basiskonfiguration
# =============================================================================

class BaseConfig:
    """
    Gemeinsame Basiskonfiguration für alle Umgebungen.
    """

    # -------------------------------------------------------------------------
    # Service-Metadaten
    # -------------------------------------------------------------------------

    APP_NAME = _DEFAULT_APP_NAME
    APP_DISPLAY_NAME = _DEFAULT_APP_DISPLAY_NAME

    APP_ENV = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_ENV",
            "FLASK_ENV",
        ),
        "development",
    )

    BUILD_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_BUILD_MODE",
            "VECTOPLAN_BUILD_MODE",
        ),
        _DEFAULT_EDITOR_BUILD_MODE,
    )

    BUILD_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_BUILD_VERSION",
            "VECTOPLAN_BUILD_VERSION",
            "GIT_SHA",
        ),
        _DEFAULT_EDITOR_BUILD_VERSION,
    )

    SERVICE_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_SERVICE_VERSION",
            "VECTOPLAN_EDITOR_VERSION",
        ),
        "0.1.0",
    )

    # -------------------------------------------------------------------------
    # Flask-Grundkonfiguration
    # -------------------------------------------------------------------------

    SECRET_KEY = _read_str_env(
        "VECTOPLAN_EDITOR_SECRET_KEY",
        "dev-secret-key-change-me",
    )

    DEBUG = _read_bool_env("VECTOPLAN_EDITOR_DEBUG", False)
    TESTING = _read_bool_env("VECTOPLAN_EDITOR_TESTING", False)

    TEMPLATES_AUTO_RELOAD = _read_bool_env(
        "VECTOPLAN_EDITOR_TEMPLATES_AUTO_RELOAD",
        True,
    )

    EXPLAIN_TEMPLATE_LOADING = _read_bool_env(
        "VECTOPLAN_EDITOR_EXPLAIN_TEMPLATE_LOADING",
        False,
    )

    SEND_FILE_MAX_AGE_DEFAULT = _read_int_env(
        "VECTOPLAN_EDITOR_SEND_FILE_MAX_AGE_DEFAULT",
        default=0,
        minimum=0,
    )

    PREFERRED_URL_SCHEME = _read_str_env(
        "VECTOPLAN_EDITOR_PREFERRED_URL_SCHEME",
        "http",
    )

    SERVER_NAME = _read_optional_str_env("VECTOPLAN_EDITOR_SERVER_NAME", None)

    APPLICATION_ROOT = _read_str_env(
        "VECTOPLAN_EDITOR_APPLICATION_ROOT",
        "/",
    )

    MAX_CONTENT_LENGTH = _read_int_env(
        "VECTOPLAN_EDITOR_MAX_CONTENT_LENGTH",
        default=16 * 1024 * 1024,
        minimum=1024,
    )

    JSON_SORT_KEYS = False
    JSONIFY_PRETTYPRINT_REGULAR = _read_bool_env(
        "VECTOPLAN_EDITOR_JSON_PRETTY",
        False,
    )

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = _read_str_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SAMESITE",
        "Lax",
    )
    SESSION_COOKIE_SECURE = _read_bool_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SECURE",
        False,
    )

    # -------------------------------------------------------------------------
    # Pfade
    # -------------------------------------------------------------------------

    SERVICE_ROOT = SERVICE_ROOT
    SRC_ROOT = _build_path("src")
    BACKEND_BOOTSTRAP_ROOT = _build_path("src", "bootstrap")
    CLIENTS_ROOT = _build_path("src", "clients")
    INVENTORY_ROOT = _build_path("src", "inventory")
    LIBRARY_INVENTORY_ROOT = _build_path("src", "library_inventory")
    ROUTES_ROOT = _build_path("routes")
    TEMPLATES_ROOT = _build_path("templates")
    TEMPLATES_EDITOR_ROOT = _build_path("templates", "editor")
    STATIC_ROOT = _build_path("static")
    STATIC_EDITOR_ROOT = _build_path("static", "editor")

    # Produktive Frontend-Wahrheit.
    FRONTEND_ROOT = _build_path("src", "frontend")
    FRONTEND_SRC_ROOT = FRONTEND_ROOT

    # Legacy-Pfad nur zur Diagnose.
    LEGACY_FRONTEND_ROOT = _build_path("frontend")

    TESTS_ROOT = _build_path("tests")

    STATIC_EDITOR_MANIFEST_PATH = _build_path(
        "static",
        "editor",
        _DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
    )

    STATIC_EDITOR_ASSETS_ROOT = _build_path("static", "editor", "assets")

    # -------------------------------------------------------------------------
    # Editor-Route, Template und Static/Vite
    # -------------------------------------------------------------------------

    EDITOR_ROUTE_PATH = _normalize_route_path(
        _read_str_env("VECTOPLAN_EDITOR_ROUTE_PATH", _DEFAULT_EDITOR_ROUTE_PATH),
        _DEFAULT_EDITOR_ROUTE_PATH,
    )

    EDITOR_TEMPLATE_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_TEMPLATE_NAME",
        _DEFAULT_EDITOR_TEMPLATE_NAME,
    )

    STATIC_EDITOR_URL_PREFIX = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_STATIC_EDITOR_URL_PREFIX",
                "VECTOPLAN_EDITOR_STATIC_URL_PREFIX",
            ),
            _DEFAULT_STATIC_EDITOR_URL_PREFIX,
        ),
        _DEFAULT_STATIC_EDITOR_URL_PREFIX,
    )

    STATIC_EDITOR_MANIFEST_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_STATIC_MANIFEST_NAME",
        _DEFAULT_STATIC_EDITOR_MANIFEST_NAME,
    )

    VITE_ENTRYPOINT = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_VITE_ENTRYPOINT",
            "VECTOPLAN_EDITOR_FRONTEND_ENTRYPOINT",
        ),
        _DEFAULT_VITE_ENTRYPOINT,
    )

    USE_VITE_MANIFEST = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_USE_VITE_MANIFEST",
            "VECTOPLAN_EDITOR_USE_MANIFEST_ASSETS",
        ),
        True,
    )

    STRICT_ASSET_CHECKS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
            "VECTOPLAN_EDITOR_FAIL_ON_MISSING_ASSETS",
        ),
        False,
    )

    FALLBACK_STATIC_JS = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_FALLBACK_STATIC_JS",
            "VECTOPLAN_EDITOR_MAIN_JS_FILE",
        ),
        "",
    )

    FALLBACK_STATIC_CSS = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_FALLBACK_STATIC_CSS",
            "VECTOPLAN_EDITOR_MAIN_CSS_FILE",
        ),
        "",
    )

    # -------------------------------------------------------------------------
    # Editor-Runtime
    # -------------------------------------------------------------------------

    EDITOR_TEMPLATE_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_TEMPLATE_MODE",
        _DEFAULT_EDITOR_TEMPLATE_MODE,
    )

    EDITOR_RUNTIME_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_RUNTIME_MODE",
        _DEFAULT_EDITOR_RUNTIME_MODE,
    )

    EDITOR_WORLD_MODE = _read_str_env(
        "VECTOPLAN_EDITOR_WORLD_MODE",
        _DEFAULT_EDITOR_WORLD_MODE,
    )

    EDITOR_SOURCE_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_SOURCE_MODE",
            "VECTOPLAN_EDITOR_WORLD_SOURCE_MODE",
        ),
        _DEFAULT_EDITOR_SOURCE_MODE,
    )

    EDITOR_PAGE_TITLE = _read_str_env(
        "VECTOPLAN_EDITOR_PAGE_TITLE",
        _DEFAULT_APP_DISPLAY_NAME,
    )

    EDITOR_BRAND_NAME = _read_str_env(
        "VECTOPLAN_EDITOR_BRAND_NAME",
        _DEFAULT_APP_DISPLAY_NAME,
    )

    EDITOR_STATUS_INITIAL = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_INITIAL",
        _DEFAULT_EDITOR_STATUS_INITIAL,
    )

    EDITOR_STATUS_LOADING = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_LOADING",
        _DEFAULT_EDITOR_STATUS_LOADING,
    )

    EDITOR_STATUS_READY = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_READY",
        _DEFAULT_EDITOR_STATUS_READY,
    )

    EDITOR_STATUS_ERROR = _read_str_env(
        "VECTOPLAN_EDITOR_STATUS_ERROR",
        _DEFAULT_EDITOR_STATUS_ERROR,
    )

    EDITOR_POINTER_LOCK_TITLE = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_TITLE",
        _DEFAULT_POINTER_LOCK_TITLE,
    )

    EDITOR_POINTER_LOCK_MESSAGE = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_MESSAGE",
        _DEFAULT_POINTER_LOCK_MESSAGE,
    )

    EDITOR_POINTER_LOCK_HINT = _read_str_env(
        "VECTOPLAN_EDITOR_POINTER_LOCK_HINT",
        _DEFAULT_POINTER_LOCK_HINT,
    )

    EDITOR_ENABLE_POINTER_LOCK = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_POINTER_LOCK",
        True,
    )

    EDITOR_ENABLE_FIRST_PERSON = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_FIRST_PERSON",
        True,
    )

    EDITOR_ENABLE_DEBUG_OVERLAY = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_DEBUG_OVERLAY",
        True,
    )

    EDITOR_ENABLE_CROSSHAIR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_CROSSHAIR",
        True,
    )

    EDITOR_ENABLE_HOTBAR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_HOTBAR",
        True,
    )

    EDITOR_ENABLE_STATUS_BAR = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_STATUS_BAR",
        True,
    )

    EDITOR_ENABLE_LOADING_OVERLAY = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_LOADING_OVERLAY",
        True,
    )

    EDITOR_ENABLE_ERROR_PANEL = _read_bool_env(
        "VECTOPLAN_EDITOR_ENABLE_ERROR_PANEL",
        True,
    )

    EDITOR_LOCAL_WORLD_FALLBACK_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
            "VECTOPLAN_EDITOR_ENABLE_LOCAL_WORLD_FALLBACK",
        ),
        False,
    )

    EDITOR_LEGACY_FRONTEND_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LEGACY_FRONTEND_ENABLED",
            "VECTOPLAN_EDITOR_ENABLE_LEGACY_FRONTEND",
        ),
        False,
    )

    EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED = _read_bool_env(
        "VECTOPLAN_EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED",
        False,
    )

    # -------------------------------------------------------------------------
    # Runtime-Kamera / Bewegung / Spawn
    # -------------------------------------------------------------------------

    EDITOR_RUNTIME_MOVE_SPEED = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_MOVE_SPEED",
        default=5.5,
        minimum=0.1,
        maximum=100.0,
    )

    EDITOR_RUNTIME_SPRINT_MULTIPLIER = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPRINT_MULTIPLIER",
        default=1.8,
        minimum=1.0,
        maximum=10.0,
    )

    EDITOR_RUNTIME_LOOK_SENSITIVITY = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_LOOK_SENSITIVITY",
        default=0.0025,
        minimum=0.0001,
        maximum=1.0,
    )

    EDITOR_RUNTIME_PLAYER_HEIGHT = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_PLAYER_HEIGHT",
        default=1.8,
        minimum=0.2,
        maximum=10.0,
    )

    EDITOR_RUNTIME_SPAWN_X = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_X",
        default=8.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_SPAWN_Y = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Y",
        default=8.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_SPAWN_Z = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_SPAWN_Z",
        default=18.0,
        minimum=-100_000.0,
        maximum=100_000.0,
    )

    EDITOR_RUNTIME_INITIAL_YAW = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_INITIAL_YAW",
        default=0.0,
        minimum=-360.0,
        maximum=360.0,
    )

    EDITOR_RUNTIME_INITIAL_PITCH = _read_float_env(
        "VECTOPLAN_EDITOR_RUNTIME_INITIAL_PITCH",
        default=0.0,
        minimum=-89.0,
        maximum=89.0,
    )

    # -------------------------------------------------------------------------
    # Library-Service / Editor-Inventory
    # -------------------------------------------------------------------------

    VECTOPLAN_LIBRARY_BASE_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_LIBRARY_BASE_URL",
                "VECTOPLAN_LIBRARY_URL",
                "VECTOPLAN_LIBRARY_SERVICE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_BASE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_SERVICE_BASE_URL",
            ),
            _DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL,
        ),
        _DEFAULT_LIBRARY_SERVICE_INTERNAL_BASE_URL,
    )

    VECTOPLAN_EDITOR_LIBRARY_BASE_URL = VECTOPLAN_LIBRARY_BASE_URL
    VECTOPLAN_LIBRARY_URL = VECTOPLAN_LIBRARY_BASE_URL
    VECTOPLAN_LIBRARY_SERVICE_URL = VECTOPLAN_LIBRARY_BASE_URL

    VECTOPLAN_LIBRARY_API_PREFIX = _normalize_api_prefix(
        _read_first_str_env(
            (
                "VECTOPLAN_LIBRARY_API_PREFIX",
                "VECTOPLAN_EDITOR_LIBRARY_API_PREFIX",
            ),
            _DEFAULT_LIBRARY_SERVICE_API_PREFIX,
        ),
        _DEFAULT_LIBRARY_SERVICE_API_PREFIX,
    )

    VECTOPLAN_EDITOR_LIBRARY_API_PREFIX = VECTOPLAN_LIBRARY_API_PREFIX

    VECTOPLAN_EDITOR_LIBRARY_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_LIBRARY_ENABLED",
            "VECTOPLAN_LIBRARY_ENABLED",
            "VECTOPLAN_EDITOR_USE_LIBRARY",
        ),
        _DEFAULT_LIBRARY_SERVICE_ENABLED,
    )

    VECTOPLAN_LIBRARY_SOURCE = _read_first_str_env(
        (
            "VECTOPLAN_LIBRARY_SOURCE",
            "VECTOPLAN_EDITOR_LIBRARY_SOURCE",
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_SOURCE",
        ),
        _DEFAULT_LIBRARY_SERVICE_SOURCE,
    )

    VECTOPLAN_LIBRARY_REQUEST_TIMEOUT = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT",
            "VECTOPLAN_LIBRARY_TIMEOUT_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT",
            "VECTOPLAN_EDITOR_LIBRARY_TIMEOUT_SECONDS",
        ),
        default=_seconds_from_ms(_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS, 5.0),
        minimum=0.1,
        maximum=120.0,
    )

    VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT_MS",
        ),
        default=_DEFAULT_LIBRARY_REQUEST_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_LIBRARY_STATUS_TIMEOUT_MS",
        ),
        default=_DEFAULT_LIBRARY_STATUS_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_CACHE_TTL_SECONDS",
        ),
        default=_DEFAULT_LIBRARY_CLIENT_CACHE_TTL_SECONDS,
        minimum=0.0,
        maximum=3600.0,
    )

    VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS = _read_first_float_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS",
            "VECTOPLAN_EDITOR_LIBRARY_STALE_CACHE_TTL_SECONDS",
        ),
        default=_DEFAULT_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS,
        minimum=0.0,
        maximum=24 * 3600.0,
    )

    VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE = _read_first_bool_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE",
            "VECTOPLAN_EDITOR_LIBRARY_ALLOW_STALE_CACHE",
        ),
        _DEFAULT_LIBRARY_CLIENT_ALLOW_STALE_CACHE,
    )

    VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES = _read_first_int_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_LIBRARY_MAX_RESPONSE_BYTES",
        ),
        default=_DEFAULT_LIBRARY_MAX_RESPONSE_BYTES,
        minimum=1024,
        maximum=100 * 1024 * 1024,
    )

    VECTOPLAN_LIBRARY_CLIENT_USER_AGENT = _read_first_str_env(
        (
            "VECTOPLAN_LIBRARY_CLIENT_USER_AGENT",
            "VECTOPLAN_EDITOR_LIBRARY_USER_AGENT",
        ),
        _DEFAULT_LIBRARY_CLIENT_USER_AGENT,
    )

    VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_LIBRARY_API_BROWSER_BASE_URL",
            ),
            _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
        ),
        _DEFAULT_EDITOR_LIBRARY_BROWSER_BASE_URL,
    )

    VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH",
                "VECTOPLAN_EDITOR_INVENTORY_API_PATH",
                "VECTOPLAN_EDITOR_INVENTORY_URL",
            ),
            _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
        ),
        _DEFAULT_EDITOR_INVENTORY_ROUTE_PATH,
    )

    VECTOPLAN_EDITOR_INVENTORY_SOURCE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
            "VECTOPLAN_LIBRARY_INVENTORY_SOURCE",
        ),
        _DEFAULT_EDITOR_INVENTORY_SOURCE,
    )

    VECTOPLAN_EDITOR_INVENTORY_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            "EDITOR_INVENTORY_ENABLED",
        ),
        True,
    )

    VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            "EDITOR_INVENTORY_HOTBAR_SIZE",
            "INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_HOTBAR_SLOTS",
        ),
        default=_DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE,
        minimum=1,
        maximum=64,
    )

    VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "INVENTORY_DEFAULT_SELECTED_SLOT",
        ),
        default=_DEFAULT_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, _DEFAULT_EDITOR_INVENTORY_HOTBAR_SIZE - 1),
    )

    VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
            "EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
        ),
        default=max(
            _DEFAULT_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT,
            VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE,
        ),
        minimum=VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE,
        maximum=512,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
            "EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
        ),
        _DEFAULT_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK,
    )

    VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK = VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
            "EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK,
    )

    VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY",
            "EDITOR_INVENTORY_ICON_ONLY",
            "INVENTORY_ICON_ONLY",
        ),
        _DEFAULT_EDITOR_INVENTORY_ICON_ONLY,
    )

    VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP",
            "EDITOR_INVENTORY_SCROLL_WRAP",
            "INVENTORY_SCROLL_WRAP",
        ),
        _DEFAULT_EDITOR_INVENTORY_SCROLL_WRAP,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
            "EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
            "INVENTORY_ALLOW_PLACE_ACTION",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_PLACE_ACTION,
    )

    VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
            "EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
            "INVENTORY_ALLOW_BREAK_ACTION",
        ),
        _DEFAULT_EDITOR_INVENTORY_ALLOW_BREAK_ACTION,
    )

    VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
            "EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
        ),
        False,
    )

    # Aliase, die `src.inventory` direkt liest.
    EDITOR_INVENTORY_ENABLED = VECTOPLAN_EDITOR_INVENTORY_ENABLED
    EDITOR_INVENTORY_HOTBAR_SIZE = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE
    INVENTORY_HOTBAR_SIZE = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE
    EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT = VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT
    INVENTORY_DEFAULT_SELECTED_SLOT = VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT
    EDITOR_INVENTORY_SCROLL_WRAP = VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP
    INVENTORY_SCROLL_WRAP = VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP
    EDITOR_INVENTORY_ALLOW_PLACE_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION
    INVENTORY_ALLOW_PLACE_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION
    EDITOR_INVENTORY_ALLOW_BREAK_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION
    INVENTORY_ALLOW_BREAK_ACTION = VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION
    EDITOR_INVENTORY_ICON_ONLY = VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY
    INVENTORY_ICON_ONLY = VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY

    # -------------------------------------------------------------------------
    # Chunk-Service / Editor-Proxy
    # -------------------------------------------------------------------------

    EDITOR_CHUNK_SERVICE_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_ENABLED",
            "EDITOR_CHUNK_SERVICE_ENABLED",
            "VECTOPLAN_EDITOR_CHUNK_ENABLED",
            "VECTOPLAN_EDITOR_REMOTE_CHUNK_ENABLED",
        ),
        _DEFAULT_CHUNK_SERVICE_ENABLED,
    )

    EDITOR_CHUNK_SERVICE_BASE_URL = _normalize_url(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BASE_URL",
                "EDITOR_CHUNK_SERVICE_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_INTERNAL_URL",
                "VECTOPLAN_CHUNK_SERVICE_INTERNAL_URL",
                "CHUNK_SERVICE_INTERNAL_URL",
            ),
            _DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL,
        ),
        _DEFAULT_CHUNK_SERVICE_INTERNAL_BASE_URL,
    )

    EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_BROWSER_BASE_URL",
                "VECTOPLAN_EDITOR_CHUNK_API_PREFIX",
            ),
            _DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL,
        ),
        _DEFAULT_CHUNK_SERVICE_BROWSER_BASE_URL,
    )

    EDITOR_CHUNK_SERVICE_API_PREFIX = _normalize_route_path(
        _read_first_str_env(
            (
                "VECTOPLAN_EDITOR_CHUNK_SERVICE_API_PREFIX",
                "EDITOR_CHUNK_SERVICE_API_PREFIX",
                "VECTOPLAN_EDITOR_CHUNK_API_PREFIX",
            ),
            _DEFAULT_CHUNK_SERVICE_API_PREFIX,
        ),
        _DEFAULT_CHUNK_SERVICE_API_PREFIX,
    )

    EDITOR_CHUNK_SERVICE_PROJECT_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "VECTOPLAN_EDITOR_DEFAULT_PROJECT_ID",
            "VECTOPLAN_CHUNK_DEFAULT_PROJECT_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_PROJECT_ID,
    )

    EDITOR_CHUNK_SERVICE_WORLD_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_WORLD_ID",
            "EDITOR_CHUNK_SERVICE_WORLD_ID",
            "VECTOPLAN_EDITOR_DEFAULT_WORLD_ID",
            "VECTOPLAN_CHUNK_DEFAULT_INSTANCE_WORLD_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_WORLD_ID,
    )

    EDITOR_CHUNK_SERVICE_SOURCE_KIND = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "VECTOPLAN_EDITOR_CHUNK_SOURCE_KIND",
        ),
        _DEFAULT_CHUNK_SERVICE_SOURCE_KIND,
    )

    EDITOR_CHUNK_SERVICE_MODE = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MODE",
            "EDITOR_CHUNK_SERVICE_MODE",
            "VECTOPLAN_EDITOR_CHUNK_MODE",
        ),
        _DEFAULT_CHUNK_SERVICE_MODE,
    )

    EDITOR_CHUNK_SERVICE_REGISTRY_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_ID",
            "EDITOR_CHUNK_SERVICE_REGISTRY_ID",
        ),
        _DEFAULT_CHUNK_SERVICE_REGISTRY_ID,
    )

    EDITOR_CHUNK_SERVICE_REGISTRY_VERSION = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
            "EDITOR_CHUNK_SERVICE_REGISTRY_VERSION",
        ),
        _DEFAULT_CHUNK_SERVICE_REGISTRY_VERSION,
    )

    EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_REQUEST_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_REQUEST_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_COMMAND_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_COMMAND_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_BATCH_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_BATCH_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "VECTOPLAN_EDITOR_CHUNK_STATUS_TIMEOUT_MS",
        ),
        default=_DEFAULT_CHUNK_STATUS_TIMEOUT_MS,
        minimum=100,
        maximum=300_000,
    )

    EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "VECTOPLAN_EDITOR_CHUNK_PREFER_BATCH_LOAD",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "VECTOPLAN_EDITOR_CHUNK_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "VECTOPLAN_EDITOR_CHUNK_MAX_BATCH_CHUNKS",
        ),
        default=_DEFAULT_CHUNK_MAX_BATCH_CHUNKS,
        minimum=1,
        maximum=10_000,
    )

    EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES = _read_first_int_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_CHUNK_MAX_RESPONSE_BYTES",
        ),
        default=_DEFAULT_CHUNK_MAX_RESPONSE_BYTES,
        minimum=1024,
        maximum=512 * 1024 * 1024,
    )

    EDITOR_CHUNK_SERVICE_ALLOW_GENERATED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_ALLOW_GENERATED",
            "EDITOR_CHUNK_SERVICE_ALLOW_GENERATED",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT",
            "EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT",
        ),
        True,
    )

    EDITOR_CHUNK_SERVICE_STATUS_PATHS = _read_csv_env(
        "VECTOPLAN_EDITOR_CHUNK_SERVICE_STATUS_PATHS",
        (
            "/",
            "/projects/_status",
            "/worlds/_status",
            "/blocks/_status",
            "/chunks/_status",
            "/commands/_status",
        ),
    )

    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
            "EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
        ),
        True,
    )

    EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
            "EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        ),
        True,
    )

    EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
            "EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER",
        ),
        False,
    )

    EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS = _read_first_bool_env(
        (
            "VECTOPLAN_EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
            "EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS",
        ),
        False,
    )

    # Backwards-compatible aliases for older code.
    EDITOR_CHUNK_ENABLED = EDITOR_CHUNK_SERVICE_ENABLED
    EDITOR_CHUNK_MODE = EDITOR_CHUNK_SERVICE_MODE
    EDITOR_CHUNK_SOURCE_KIND = EDITOR_CHUNK_SERVICE_SOURCE_KIND
    EDITOR_CHUNK_SERVICE_INTERNAL_URL = EDITOR_CHUNK_SERVICE_BASE_URL
    EDITOR_CHUNK_API_PREFIX = EDITOR_CHUNK_SERVICE_API_PREFIX
    EDITOR_CHUNK_BROWSER_BASE_URL = EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL
    EDITOR_DEFAULT_PROJECT_ID = EDITOR_CHUNK_SERVICE_PROJECT_ID
    EDITOR_DEFAULT_WORLD_ID = EDITOR_CHUNK_SERVICE_WORLD_ID
    EDITOR_CHUNK_DEFAULT_PROJECT_ID = EDITOR_CHUNK_SERVICE_PROJECT_ID
    EDITOR_CHUNK_DEFAULT_WORLD_ID = EDITOR_CHUNK_SERVICE_WORLD_ID

    EDITOR_CHUNK_REQUEST_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS,
        10.0,
    )
    EDITOR_CHUNK_COMMAND_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS,
        15.0,
    )
    EDITOR_CHUNK_BATCH_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS,
        20.0,
    )
    EDITOR_CHUNK_STATUS_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS,
        5.0,
    )

    # -------------------------------------------------------------------------
    # Legacy Placeholder-Hotbar / Placeable Blocks
    # -------------------------------------------------------------------------

    EDITOR_PLACEABLE_BLOCKS = _read_json_env(
        "VECTOPLAN_EDITOR_PLACEABLE_BLOCKS_JSON",
        [dict(block) for block in _cached_default_placeable_blocks()],
    )

    # Alias bleibt für ältere Frontend-Teile.
    EDITOR_HOTBAR_SLOTS = VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE

    EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID = _read_first_str_env(
        (
            "VECTOPLAN_EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID",
            "VECTOPLAN_EDITOR_DEFAULT_BLOCK_TYPE_ID",
        ),
        "",
    )

    # -------------------------------------------------------------------------
    # CORS / Proxy / Security-Vorbereitung
    # -------------------------------------------------------------------------

    CORS_ENABLED = _read_bool_env(
        "VECTOPLAN_EDITOR_CORS_ENABLED",
        False,
    )

    CORS_ALLOWED_ORIGINS = _read_csv_env(
        "VECTOPLAN_EDITOR_CORS_ALLOWED_ORIGINS",
        _DEFAULT_ALLOWED_ORIGINS,
    )

    PROXY_TRUST_X_FORWARDED = _read_bool_env(
        "VECTOPLAN_EDITOR_PROXY_TRUST_X_FORWARDED",
        False,
    )

    # -------------------------------------------------------------------------
    # Hilfsmethoden
    # -------------------------------------------------------------------------

    @classmethod
    def get_static_paths(cls) -> dict[str, str]:
        return dict(
            _cached_static_paths(
                cls.STATIC_EDITOR_URL_PREFIX,
                cls.STATIC_EDITOR_MANIFEST_NAME,
            )
        )

    @classmethod
    def get_editor_slot_labels(cls) -> list[str]:
        try:
            slot_count = int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE)
        except (TypeError, ValueError):
            slot_count = DEFAULT_HOTBAR_SIZE

        slot_count = max(1, min(slot_count, 64))
        return [str(index) for index in range(1, slot_count + 1)]

    @classmethod
    def get_placeable_blocks(cls) -> list[dict[str, Any]]:
        """
        Legacy-/Debug-Placeable-Blocks.

        Wichtig:
        - Diese Daten sind nicht mehr die fachliche Inventory-Wahrheit.
        - Das produktive Inventory kommt aus /editor/api/inventory.
        - Standardmäßig wird hier eine leere Liste geliefert, solange der
          Chunk-Fallback nicht explizit aktiviert ist.
        """
        if not bool(cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK):
            return []

        blocks = cls.EDITOR_PLACEABLE_BLOCKS

        if not isinstance(blocks, list):
            return [dict(block) for block in _cached_default_placeable_blocks()]

        normalized: list[dict[str, Any]] = []

        for item in blocks:
            if not isinstance(item, dict):
                continue

            block_type_id = _normalize_text(item.get("blockTypeId"))
            if block_type_id is None:
                continue

            block = dict(item)
            block["blockTypeId"] = block_type_id
            block.setdefault("label", block_type_id)
            block.setdefault("solid", True)
            block.setdefault("placeable", True)
            block.setdefault("breakable", True)
            block.setdefault("debugOnly", True)

            normalized.append(block)

        return normalized or [dict(block) for block in _cached_default_placeable_blocks()]

    @classmethod
    def build_chunk_route_hints(cls) -> dict[str, str]:
        return dict(
            _cached_chunk_route_hints(
                cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
                cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
                cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
            )
        )

    @classmethod
    def build_library_route_hints(cls) -> dict[str, str]:
        return dict(
            _cached_library_route_hints(
                cls.VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL,
                cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
            )
        )

    @classmethod
    def build_library_service_config(cls, include_internal: bool = False) -> dict[str, Any]:
        route_hints = cls.build_library_route_hints()

        payload: dict[str, Any] = {
            "enabled": bool(cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED),
            "source": str(cls.VECTOPLAN_LIBRARY_SOURCE),
            "browserBaseUrl": str(cls.VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL),
            "inventoryRoute": str(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH),
            "routeHints": route_hints,
            "requestTimeoutMs": int(cls.VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS),
            "cacheTtlSeconds": float(cls.VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS),
            "staleCacheTtlSeconds": float(cls.VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS),
            "allowStaleCache": bool(cls.VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE),
        }

        if include_internal:
            payload["internalBaseUrl"] = str(cls.VECTOPLAN_LIBRARY_BASE_URL)
            payload["apiPrefix"] = str(cls.VECTOPLAN_LIBRARY_API_PREFIX)
            payload["requestTimeoutSeconds"] = float(cls.VECTOPLAN_LIBRARY_REQUEST_TIMEOUT)
            payload["maxResponseBytes"] = int(cls.VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES)
            payload["userAgent"] = str(cls.VECTOPLAN_LIBRARY_CLIENT_USER_AGENT)

        return payload

    @classmethod
    def build_inventory_config(cls) -> dict[str, Any]:
        return {
            "enabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ENABLED),
            "source": str(cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE),
            "route": str(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH),
            "hotbarSize": int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE),
            "defaultSelectedSlot": int(cls.VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT),
            "libraryItemsLimit": int(cls.VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT),
            "allowChunkPlaceableFallback": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK),
            "allowEmptyFallback": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK),
            "iconOnly": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY),
            "scrollWrap": bool(cls.VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP),
            "allowPlaceAction": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION),
            "allowBreakAction": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION),
            "forceRefreshOnBoot": bool(cls.VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT),
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
        }

    @classmethod
    def build_chunk_service_config(cls, include_internal: bool = False) -> dict[str, Any]:
        route_hints = cls.build_chunk_route_hints()

        payload: dict[str, Any] = {
            "enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "mode": str(cls.EDITOR_CHUNK_SERVICE_MODE),
            "sourceKind": str(cls.EDITOR_CHUNK_SERVICE_SOURCE_KIND),
            "apiBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "browserBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "projectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "worldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "registryId": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_ID),
            "registryVersion": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_VERSION),
            "routeHints": route_hints,
            "requestTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS),
            "commandTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS),
            "batchTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS),
            "preferBatchLoad": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD),
            "reloadDirtyChunksAfterCommand": bool(
                cls.EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND
            ),
            "maxBatchChunks": int(cls.EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS),
            "allowGenerated": bool(cls.EDITOR_CHUNK_SERVICE_ALLOW_GENERATED),
            "preferSnapshot": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT),
        }

        if include_internal:
            payload["internalBaseUrl"] = str(cls.EDITOR_CHUNK_SERVICE_BASE_URL)
            payload["maxResponseBytes"] = int(cls.EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES)
            payload["statusPaths"] = list(cls.EDITOR_CHUNK_SERVICE_STATUS_PATHS)

        return payload

    @classmethod
    def build_chunk_proxy_settings(cls) -> dict[str, Any]:
        return {
            "enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "internalBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BASE_URL),
            "browserBaseUrl": str(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL),
            "apiPrefix": str(cls.EDITOR_CHUNK_SERVICE_API_PREFIX),
            "projectId": str(cls.EDITOR_CHUNK_SERVICE_PROJECT_ID),
            "worldId": str(cls.EDITOR_CHUNK_SERVICE_WORLD_ID),
            "sourceKind": str(cls.EDITOR_CHUNK_SERVICE_SOURCE_KIND),
            "mode": str(cls.EDITOR_CHUNK_SERVICE_MODE),
            "registryId": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_ID),
            "registryVersion": str(cls.EDITOR_CHUNK_SERVICE_REGISTRY_VERSION),
            "requestTimeoutSeconds": float(cls.EDITOR_CHUNK_REQUEST_TIMEOUT),
            "commandTimeoutSeconds": float(cls.EDITOR_CHUNK_COMMAND_TIMEOUT),
            "batchTimeoutSeconds": float(cls.EDITOR_CHUNK_BATCH_TIMEOUT),
            "statusTimeoutSeconds": float(cls.EDITOR_CHUNK_STATUS_TIMEOUT),
            "requestTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS),
            "commandTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS),
            "batchTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS),
            "statusTimeoutMs": int(cls.EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS),
            "preferBatchLoad": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD),
            "reloadDirtyChunksAfterCommand": bool(
                cls.EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND
            ),
            "maxBatchChunks": int(cls.EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS),
            "maxResponseBytes": int(cls.EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES),
            "allowGenerated": bool(cls.EDITOR_CHUNK_SERVICE_ALLOW_GENERATED),
            "preferSnapshot": bool(cls.EDITOR_CHUNK_SERVICE_PREFER_SNAPSHOT),
            "statusPaths": list(cls.EDITOR_CHUNK_SERVICE_STATUS_PATHS),
            "routeHints": cls.build_chunk_route_hints(),
            "diagnostics": {
                "enabled": bool(cls.EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED),
                "includeUpstreamDetails": bool(cls.EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS),
            },
            "placeableBlocks": {
                "placeholderEnabled": bool(
                    cls.EDITOR_CHUNK_PROXY_ENABLE_PLACEABLE_BLOCKS_PLACEHOLDER
                ),
                "allowChunkPlaceableFallback": bool(
                    cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK
                ),
                "blocks": cls.get_placeable_blocks(),
                "debugOnly": True,
            },
            "forwardUserHeaders": bool(cls.EDITOR_CHUNK_PROXY_FORWARD_USER_HEADERS),
        }

    @classmethod
    def build_runtime_feature_flags(cls) -> dict[str, bool]:
        return {
            "chunkServiceEnabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "libraryServiceEnabled": bool(cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED),
            "inventoryEnabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_ENABLED),
            "libraryInventoryEnabled": bool(cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE == "library"),
            "chunkPlaceableFallbackEnabled": bool(cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK),
            "onlyLibraryItemsPlaceable": True,
            "debugBlocksAllowedInInventory": False,
            "localWorldFallbackEnabled": bool(cls.EDITOR_LOCAL_WORLD_FALLBACK_ENABLED),
            "legacyFrontendEnabled": bool(cls.EDITOR_LEGACY_FRONTEND_ENABLED),
            "pointerLockEnabled": bool(cls.EDITOR_ENABLE_POINTER_LOCK),
            "firstPersonEnabled": bool(cls.EDITOR_ENABLE_FIRST_PERSON),
            "debugOverlayEnabled": bool(cls.EDITOR_ENABLE_DEBUG_OVERLAY),
            "crosshairEnabled": bool(cls.EDITOR_ENABLE_CROSSHAIR),
            "hotbarEnabled": bool(cls.EDITOR_ENABLE_HOTBAR),
            "statusBarEnabled": bool(cls.EDITOR_ENABLE_STATUS_BAR),
            "loadingOverlayEnabled": bool(cls.EDITOR_ENABLE_LOADING_OVERLAY),
            "errorPanelEnabled": bool(cls.EDITOR_ENABLE_ERROR_PANEL),
            "remoteChunkServiceRequired": bool(cls.EDITOR_REMOTE_CHUNK_SERVICE_REQUIRED),
        }

    @classmethod
    def build_editor_bootstrap_payload(cls) -> dict[str, Any]:
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()

        return {
            "service": {
                "name": cls.APP_NAME,
                "displayName": cls.APP_DISPLAY_NAME,
                "version": cls.SERVICE_VERSION,
                "environment": cls.APP_ENV,
            },
            "build": {
                "mode": cls.BUILD_MODE,
                "version": cls.BUILD_VERSION,
            },
            "project": {
                "projectId": cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
                "worldId": cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
            },
            "runtime": {
                "mode": cls.EDITOR_RUNTIME_MODE,
                "worldMode": cls.EDITOR_WORLD_MODE,
                "sourceMode": cls.EDITOR_SOURCE_MODE,
                "chunk": chunk_config,
                "library": library_config,
                "inventory": inventory_config,
                "camera": {
                    "spawn": {
                        "x": float(cls.EDITOR_RUNTIME_SPAWN_X),
                        "y": float(cls.EDITOR_RUNTIME_SPAWN_Y),
                        "z": float(cls.EDITOR_RUNTIME_SPAWN_Z),
                    },
                    "yaw": float(cls.EDITOR_RUNTIME_INITIAL_YAW),
                    "pitch": float(cls.EDITOR_RUNTIME_INITIAL_PITCH),
                    "moveSpeed": float(cls.EDITOR_RUNTIME_MOVE_SPEED),
                    "sprintMultiplier": float(cls.EDITOR_RUNTIME_SPRINT_MULTIPLIER),
                    "lookSensitivity": float(cls.EDITOR_RUNTIME_LOOK_SENSITIVITY),
                    "playerHeight": float(cls.EDITOR_RUNTIME_PLAYER_HEIGHT),
                },
                "ui": {
                    "pageTitle": cls.EDITOR_PAGE_TITLE,
                    "brandName": cls.EDITOR_BRAND_NAME,
                    "statusInitial": cls.EDITOR_STATUS_INITIAL,
                    "statusLoading": cls.EDITOR_STATUS_LOADING,
                    "statusReady": cls.EDITOR_STATUS_READY,
                    "statusError": cls.EDITOR_STATUS_ERROR,
                    "pointerLockTitle": cls.EDITOR_POINTER_LOCK_TITLE,
                    "pointerLockMessage": cls.EDITOR_POINTER_LOCK_MESSAGE,
                    "pointerLockHint": cls.EDITOR_POINTER_LOCK_HINT,
                    "hotbarSlots": int(cls.VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE),
                    "defaultBlockTypeId": cls.EDITOR_HOTBAR_DEFAULT_BLOCK_TYPE_ID,
                    "inventoryRoute": cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
                    "inventorySource": cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE,
                },
                "featureFlags": cls.build_runtime_feature_flags(),
            },
            "library": library_config,
            "inventory": inventory_config,
            "featureFlags": cls.build_runtime_feature_flags(),
        }

    @classmethod
    def build_root_dataset_values(cls) -> dict[str, str]:
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()

        return {
            "editor-root": "true",
            "editor-runtime-mode": cls.EDITOR_RUNTIME_MODE,
            "editor-world-mode": cls.EDITOR_WORLD_MODE,
            "editor-source-mode": cls.EDITOR_SOURCE_MODE,
            "editor-build-mode": cls.BUILD_MODE,
            "editor-build-version": cls.BUILD_VERSION,
            "chunk-service-enabled": "true" if cls.EDITOR_CHUNK_SERVICE_ENABLED else "false",
            "chunk-service-api-base-url": chunk_config["apiBaseUrl"],
            "chunk-service-browser-base-url": chunk_config["browserBaseUrl"],
            "chunk-service-project-id": chunk_config["projectId"],
            "chunk-service-world-id": chunk_config["worldId"],
            "chunk-service-source-kind": chunk_config["sourceKind"],
            "chunk-service-mode": chunk_config["mode"],
            "library-service-enabled": "true" if cls.VECTOPLAN_EDITOR_LIBRARY_ENABLED else "false",
            "library-browser-base-url": library_config["browserBaseUrl"],
            "library-inventory-route": library_config["inventoryRoute"],
            "inventory-enabled": "true" if inventory_config["enabled"] else "false",
            "inventory-source": inventory_config["source"],
            "inventory-route": inventory_config["route"],
            "inventory-hotbar-size": str(inventory_config["hotbarSize"]),
            "inventory-default-selected-slot": str(inventory_config["defaultSelectedSlot"]),
            "inventory-only-library-items-placeable": "true",
            "inventory-chunk-placeable-fallback": "true"
            if inventory_config["allowChunkPlaceableFallback"]
            else "false",
        }

    @classmethod
    def build_editor_template_context(cls) -> dict[str, Any]:
        static_paths = cls.get_static_paths()
        chunk_config = cls.build_chunk_service_config(include_internal=False)
        chunk_proxy = cls.build_chunk_proxy_settings()
        library_config = cls.build_library_service_config(include_internal=False)
        inventory_config = cls.build_inventory_config()

        return {
            "app_name": cls.APP_NAME,
            "app_display_name": cls.APP_DISPLAY_NAME,
            "page_title": cls.EDITOR_PAGE_TITLE,
            "brand_name": cls.EDITOR_BRAND_NAME,
            "editor_route_path": cls.EDITOR_ROUTE_PATH,
            "editor_template_name": cls.EDITOR_TEMPLATE_NAME,
            "editor_template_mode": cls.EDITOR_TEMPLATE_MODE,
            "editor_runtime_mode": cls.EDITOR_RUNTIME_MODE,
            "editor_world_mode": cls.EDITOR_WORLD_MODE,
            "editor_source_mode": cls.EDITOR_SOURCE_MODE,
            "build_mode": cls.BUILD_MODE,
            "build_version": cls.BUILD_VERSION,
            "service_version": cls.SERVICE_VERSION,
            "static_editor_url_prefix": cls.STATIC_EDITOR_URL_PREFIX,
            "static_editor_manifest_name": cls.STATIC_EDITOR_MANIFEST_NAME,
            "static_editor_manifest_url": static_paths["manifestUrl"],
            "vite_entrypoint": cls.VITE_ENTRYPOINT,
            "use_vite_manifest": bool(cls.USE_VITE_MANIFEST),
            "strict_asset_checks": bool(cls.STRICT_ASSET_CHECKS),
            "fallback_static_js": cls.FALLBACK_STATIC_JS,
            "fallback_static_css": cls.FALLBACK_STATIC_CSS,
            "status_initial": cls.EDITOR_STATUS_INITIAL,
            "status_loading": cls.EDITOR_STATUS_LOADING,
            "status_ready": cls.EDITOR_STATUS_READY,
            "status_error": cls.EDITOR_STATUS_ERROR,
            "pointer_lock_title": cls.EDITOR_POINTER_LOCK_TITLE,
            "pointer_lock_message": cls.EDITOR_POINTER_LOCK_MESSAGE,
            "pointer_lock_hint": cls.EDITOR_POINTER_LOCK_HINT,
            "feature_flags": cls.build_runtime_feature_flags(),
            "bootstrap_payload": cls.build_editor_bootstrap_payload(),
            "root_dataset_values": cls.build_root_dataset_values(),
            "chunk": chunk_config,
            "chunk_config": chunk_config,
            "chunk_proxy": chunk_proxy,
            "chunk_route_hints": cls.build_chunk_route_hints(),
            "chunk_enabled": bool(cls.EDITOR_CHUNK_SERVICE_ENABLED),
            "chunk_api_base_url": cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
            "chunk_browser_base_url": cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL,
            "chunk_project_id": cls.EDITOR_CHUNK_SERVICE_PROJECT_ID,
            "chunk_world_id": cls.EDITOR_CHUNK_SERVICE_WORLD_ID,
            "library": library_config,
            "library_config": library_config,
            "library_route_hints": cls.build_library_route_hints(),
            "inventory": inventory_config,
            "inventory_config": inventory_config,
            "inventory_route": cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH,
            "inventory_source": cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE,
            "placeable_blocks": cls.get_placeable_blocks(),
            "hotbar_slots": cls.get_editor_slot_labels(),
        }

    @classmethod
    def validate(cls) -> list[str]:
        errors: list[str] = []

        def require_text(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{attribute_name} muss ein nicht-leerer String sein.")

        def require_path(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, Path):
                errors.append(f"{attribute_name} muss ein pathlib.Path sein.")

        def require_bool(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, bool):
                errors.append(f"{attribute_name} muss ein bool sein.")

        def require_positive_number(attribute_name: str) -> None:
            value = getattr(cls, attribute_name, None)
            if not isinstance(value, (int, float)) or value <= 0:
                errors.append(f"{attribute_name} muss numerisch und größer als 0 sein.")

        for attribute_name in (
            "APP_NAME",
            "APP_DISPLAY_NAME",
            "APP_ENV",
            "EDITOR_ROUTE_PATH",
            "EDITOR_TEMPLATE_NAME",
            "STATIC_EDITOR_URL_PREFIX",
            "STATIC_EDITOR_MANIFEST_NAME",
            "VITE_ENTRYPOINT",
            "EDITOR_RUNTIME_MODE",
            "EDITOR_WORLD_MODE",
            "EDITOR_SOURCE_MODE",
            "EDITOR_CHUNK_SERVICE_BASE_URL",
            "EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL",
            "EDITOR_CHUNK_SERVICE_PROJECT_ID",
            "EDITOR_CHUNK_SERVICE_WORLD_ID",
            "EDITOR_CHUNK_SERVICE_SOURCE_KIND",
            "EDITOR_CHUNK_SERVICE_MODE",
            "VECTOPLAN_LIBRARY_BASE_URL",
            "VECTOPLAN_LIBRARY_API_PREFIX",
            "VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH",
            "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
        ):
            require_text(attribute_name)

        for attribute_name in (
            "SERVICE_ROOT",
            "SRC_ROOT",
            "BACKEND_BOOTSTRAP_ROOT",
            "CLIENTS_ROOT",
            "INVENTORY_ROOT",
            "LIBRARY_INVENTORY_ROOT",
            "ROUTES_ROOT",
            "TEMPLATES_ROOT",
            "TEMPLATES_EDITOR_ROOT",
            "STATIC_ROOT",
            "STATIC_EDITOR_ROOT",
            "FRONTEND_ROOT",
            "FRONTEND_SRC_ROOT",
            "LEGACY_FRONTEND_ROOT",
            "STATIC_EDITOR_MANIFEST_PATH",
            "STATIC_EDITOR_ASSETS_ROOT",
        ):
            require_path(attribute_name)

        for attribute_name in (
            "DEBUG",
            "TESTING",
            "USE_VITE_MANIFEST",
            "STRICT_ASSET_CHECKS",
            "EDITOR_CHUNK_SERVICE_ENABLED",
            "EDITOR_CHUNK_SERVICE_PREFER_BATCH_LOAD",
            "EDITOR_CHUNK_SERVICE_RELOAD_DIRTY_CHUNKS_AFTER_COMMAND",
            "EDITOR_LOCAL_WORLD_FALLBACK_ENABLED",
            "EDITOR_LEGACY_FRONTEND_ENABLED",
            "VECTOPLAN_EDITOR_LIBRARY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
            "VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
        ):
            require_bool(attribute_name)

        for attribute_name in (
            "EDITOR_CHUNK_SERVICE_REQUEST_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_COMMAND_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_BATCH_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
            "EDITOR_CHUNK_SERVICE_MAX_BATCH_CHUNKS",
            "EDITOR_CHUNK_SERVICE_MAX_RESPONSE_BYTES",
            "EDITOR_RUNTIME_MOVE_SPEED",
            "EDITOR_RUNTIME_SPRINT_MULTIPLIER",
            "EDITOR_RUNTIME_LOOK_SENSITIVITY",
            "EDITOR_RUNTIME_PLAYER_HEIGHT",
            "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS",
            "VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS",
            "VECTOPLAN_LIBRARY_CLIENT_MAX_RESPONSE_BYTES",
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
        ):
            require_positive_number(attribute_name)

        if isinstance(cls.EDITOR_ROUTE_PATH, str) and not cls.EDITOR_ROUTE_PATH.startswith("/"):
            errors.append("EDITOR_ROUTE_PATH muss mit '/' beginnen.")

        if isinstance(cls.STATIC_EDITOR_URL_PREFIX, str) and not cls.STATIC_EDITOR_URL_PREFIX.startswith("/"):
            errors.append("STATIC_EDITOR_URL_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL, str):
            if not cls.EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL.startswith("/"):
                errors.append("EDITOR_CHUNK_SERVICE_BROWSER_BASE_URL muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_API_PREFIX, str):
            if not cls.EDITOR_CHUNK_SERVICE_API_PREFIX.startswith("/"):
                errors.append("EDITOR_CHUNK_SERVICE_API_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.EDITOR_CHUNK_SERVICE_BASE_URL, str):
            if not (
                cls.EDITOR_CHUNK_SERVICE_BASE_URL.startswith("http://")
                or cls.EDITOR_CHUNK_SERVICE_BASE_URL.startswith("https://")
            ):
                errors.append("EDITOR_CHUNK_SERVICE_BASE_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_LIBRARY_BASE_URL, str):
            if not (
                cls.VECTOPLAN_LIBRARY_BASE_URL.startswith("http://")
                or cls.VECTOPLAN_LIBRARY_BASE_URL.startswith("https://")
            ):
                errors.append("VECTOPLAN_LIBRARY_BASE_URL muss mit http:// oder https:// beginnen.")

        if isinstance(cls.VECTOPLAN_LIBRARY_API_PREFIX, str):
            if not cls.VECTOPLAN_LIBRARY_API_PREFIX.startswith("/"):
                errors.append("VECTOPLAN_LIBRARY_API_PREFIX muss mit '/' beginnen.")

        if isinstance(cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH, str):
            if not cls.VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH.startswith("/"):
                errors.append("VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH muss mit '/' beginnen.")

        if cls.EDITOR_LOCAL_WORLD_FALLBACK_ENABLED:
            errors.append(
                "EDITOR_LOCAL_WORLD_FALLBACK_ENABLED ist aktiv. Für den Remote-Chunk-Slice sollte der Wert false sein."
            )

        if cls.EDITOR_LEGACY_FRONTEND_ENABLED:
            errors.append(
                "EDITOR_LEGACY_FRONTEND_ENABLED ist aktiv. Für src/frontend sollte der Wert false sein."
            )

        if cls.VECTOPLAN_EDITOR_INVENTORY_SOURCE != "library":
            errors.append(
                "VECTOPLAN_EDITOR_INVENTORY_SOURCE sollte aktuell 'library' sein, damit nur VPLIB-Items placebar sind."
            )

        if cls.VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK:
            errors.append(
                "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK ist aktiv. Dadurch könnten Debug-Blöcke wieder als Fallback erscheinen."
            )

        return errors


# =============================================================================
# Umgebungsspezifische Klassen
# =============================================================================

class Config(BaseConfig):
    """
    Default-Konfiguration für lokale Entwicklung.
    """

    APP_ENV = _read_str_env("VECTOPLAN_EDITOR_ENV", "development")
    DEBUG = _read_bool_env("VECTOPLAN_EDITOR_DEBUG", True)
    TESTING = _read_bool_env("VECTOPLAN_EDITOR_TESTING", False)
    TEMPLATES_AUTO_RELOAD = _read_bool_env(
        "VECTOPLAN_EDITOR_TEMPLATES_AUTO_RELOAD",
        True,
    )


class DevelopmentConfig(BaseConfig):
    """
    Explizite Entwicklungs-Konfiguration.
    """

    APP_ENV = "development"
    DEBUG = True
    TESTING = False
    TEMPLATES_AUTO_RELOAD = True
    SEND_FILE_MAX_AGE_DEFAULT = 0
    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = True
    EDITOR_ENABLE_DEBUG_OVERLAY = True
    VECTOPLAN_EDITOR_LIBRARY_ENABLED = True
    VECTOPLAN_EDITOR_INVENTORY_ENABLED = True


class TestingConfig(BaseConfig):
    """
    Test-Konfiguration.
    """

    APP_ENV = "testing"
    DEBUG = True
    TESTING = True
    SECRET_KEY = _read_str_env(
        "VECTOPLAN_EDITOR_TEST_SECRET_KEY",
        "test-secret-key",
    )
    TEMPLATES_AUTO_RELOAD = True
    SEND_FILE_MAX_AGE_DEFAULT = 0
    EDITOR_ENABLE_DEBUG_OVERLAY = False
    VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS = 0.0
    VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS = 0.0
    VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK = True
    EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS = _read_int_env(
        "VECTOPLAN_EDITOR_TEST_CHUNK_SERVICE_STATUS_TIMEOUT_MS",
        default=1_000,
        minimum=100,
        maximum=30_000,
    )
    EDITOR_CHUNK_STATUS_TIMEOUT = _seconds_from_ms(
        EDITOR_CHUNK_SERVICE_STATUS_TIMEOUT_MS,
        1.0,
    )


class ProductionConfig(BaseConfig):
    """
    Produktionsnähere Konfiguration.
    """

    APP_ENV = "production"
    DEBUG = False
    TESTING = False
    TEMPLATES_AUTO_RELOAD = False
    SEND_FILE_MAX_AGE_DEFAULT = _read_int_env(
        "VECTOPLAN_EDITOR_SEND_FILE_MAX_AGE_DEFAULT",
        default=3600,
        minimum=0,
    )
    SESSION_COOKIE_SECURE = _read_bool_env(
        "VECTOPLAN_EDITOR_SESSION_COOKIE_SECURE",
        True,
    )
    EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED = _read_bool_env(
        "VECTOPLAN_EDITOR_CHUNK_PROXY_DIAGNOSTICS_ENABLED",
        False,
    )
    EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS = _read_bool_env(
        "VECTOPLAN_EDITOR_CHUNK_PROXY_INCLUDE_UPSTREAM_DETAILS",
        False,
    )
    STRICT_ASSET_CHECKS = _read_bool_env(
        "VECTOPLAN_EDITOR_STRICT_ASSET_CHECKS",
        True,
    )
    VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE = True
    VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK = False
    VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK = False


CONFIG_BY_NAME: Final[dict[str, type[BaseConfig]]] = {
    "default": Config,
    "config": Config,
    "development": DevelopmentConfig,
    "dev": DevelopmentConfig,
    "testing": TestingConfig,
    "test": TestingConfig,
    "production": ProductionConfig,
    "prod": ProductionConfig,
}


def get_config_class(name: str | None = None) -> type[BaseConfig]:
    requested_name = _normalize_text(name)

    if requested_name is None:
        requested_name = _read_str_env("VECTOPLAN_EDITOR_CONFIG", "default")

    key = requested_name.lower()
    return CONFIG_BY_NAME.get(key, Config)


__all__ = [
    "BaseConfig",
    "Config",
    "DevelopmentConfig",
    "TestingConfig",
    "ProductionConfig",
    "CONFIG_BY_NAME",
    "get_config_class",
]
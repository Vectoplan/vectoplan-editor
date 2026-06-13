# services/vectoplan-editor/routes/editor.py
from __future__ import annotations

import copy
import importlib
import inspect
import json
import time
import uuid
from collections.abc import Callable, Mapping
from functools import lru_cache
from http import HTTPStatus
from types import ModuleType
from typing import Any, Final

from flask import Blueprint, Response, current_app, make_response, render_template, request, url_for
from jinja2 import TemplateNotFound


# =============================================================================
# Blueprint / Routen
# =============================================================================

EDITOR_BLUEPRINT_NAME: Final[str] = "editor"
EDITOR_ROUTE_PATH: Final[str] = "/editor"
EDITOR_ROUTE_PATH_SLASH: Final[str] = "/editor/"

editor_bp = Blueprint(EDITOR_BLUEPRINT_NAME, __name__)


# =============================================================================
# Templates / Bootstrap / Integration
# =============================================================================

DEFAULT_EDITOR_TEMPLATE_NAME: Final[str] = "editor/index.html"
DEFAULT_EDITOR_FALLBACK_TEMPLATE_NAME: Final[str] = "editor/fallback.html"

_EDITOR_BOOTSTRAP_MODULE_NAME: Final[str] = "src.bootstrap"
_EDITOR_INVENTORY_MODULE_NAME: Final[str] = "src.inventory"

EDITOR_ROUTE_MODULE_VERSION: Final[str] = "0.6.0"

DEFAULT_LIBRARY_BROWSER_BASE_URL: Final[str] = "/editor/api/library"
DEFAULT_INVENTORY_ROUTE_PATH: Final[str] = "/editor/api/inventory"
DEFAULT_INVENTORY_SOURCE: Final[str] = "library"
DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0


# =============================================================================
# Defensive Helper
# =============================================================================

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    if value is None:
        return default

    try:
        normalized = str(value).strip()
    except Exception:
        return default

    return normalized or default


def _coerce_text(value: Any, default: str) -> str:
    normalized = _normalize_text(value, default)
    return normalized if normalized is not None else default


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, int) and not isinstance(value, bool):
        return bool(value)

    if value is None:
        return default

    try:
        normalized = str(value).strip().lower()
    except Exception:
        return default

    if normalized in {"1", "true", "t", "yes", "y", "on", "enabled"}:
        return True

    if normalized in {"0", "false", "f", "no", "n", "off", "disabled"}:
        return False

    return default


def _coerce_int(
    value: Any,
    default: int,
    *,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int:
    try:
        if isinstance(value, bool):
            result = int(value)
        elif isinstance(value, int):
            result = value
        elif isinstance(value, float):
            result = int(value)
        elif isinstance(value, str):
            stripped = value.strip()
            result = int(float(stripped)) if stripped else default
        else:
            result = int(value)
    except Exception:
        result = default

    if minimum is not None and result < minimum:
        return minimum

    if maximum is not None and result > maximum:
        return maximum

    return result


def _coerce_float(
    value: Any,
    default: float,
    *,
    minimum: float | None = None,
    maximum: float | None = None,
) -> float:
    try:
        if isinstance(value, bool):
            result = float(int(value))
        elif isinstance(value, (int, float)):
            result = float(value)
        elif isinstance(value, str):
            stripped = value.strip()
            result = float(stripped) if stripped else default
        else:
            result = float(value)
    except Exception:
        result = default

    if minimum is not None and result < minimum:
        return minimum

    if maximum is not None and result > maximum:
        return maximum

    return result


def _normalize_route_path(value: Any, default: str) -> str:
    raw_value = _normalize_text(value, default) or default

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


def _safe_deepcopy(value: Any) -> Any:
    try:
        return copy.deepcopy(value)
    except Exception:
        try:
            return json.loads(json.dumps(value, ensure_ascii=False, default=str))
        except Exception:
            return value


def _json_safe(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, Mapping):
        return {str(key): _json_safe(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]

    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


def _safe_log_debug(message: str, *args: Any) -> None:
    try:
        current_app.logger.debug(message, *args)
    except Exception:
        pass


def _safe_log_warning(message: str, *args: Any) -> None:
    try:
        current_app.logger.warning(message, *args)
    except Exception:
        pass


def _safe_log_exception(message: str, *args: Any) -> None:
    try:
        current_app.logger.exception(message, *args)
    except Exception:
        pass


def _safe_get_config_value(key: str, default: Any = None) -> Any:
    try:
        return current_app.config.get(key, default)
    except Exception:
        return default


def _resolve_first_config_value(default: Any, *keys: str) -> Any:
    for key in keys:
        value = _safe_get_config_value(key, None)
        if value not in {None, ""}:
            return value
    return default


def _safe_static_url(filename: str) -> str:
    clean_filename = _coerce_text(filename, "").lstrip("/")
    if not clean_filename:
        return "/static/"

    try:
        return url_for("static", filename=clean_filename)
    except Exception:
        return f"/static/{clean_filename}"


def _build_static_url(filename: str) -> str:
    return _safe_static_url(filename)


def _request_id() -> str:
    try:
        existing = (
            request.headers.get("X-Request-Id")
            or request.headers.get("X-Request-ID")
            or request.headers.get("X-Correlation-ID")
            or request.headers.get("X-Vectoplan-Request-Id")
            or request.headers.get("X-VECTOPLAN-Request-ID")
            or request.args.get("requestId")
        )
    except Exception:
        existing = None

    return str(existing) if existing else uuid.uuid4().hex


def _elapsed_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000.0, 3)


def _call_with_supported_kwargs(
    callback: Callable[..., Any],
    kwargs: Mapping[str, Any],
) -> Any:
    kwargs_dict = dict(kwargs)

    try:
        signature = inspect.signature(callback)
    except Exception:
        try:
            return callback(**kwargs_dict)
        except TypeError:
            return callback()

    parameters = signature.parameters
    accepts_var_kwargs = any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )

    if accepts_var_kwargs:
        return callback(**kwargs_dict)

    supported_kwargs: dict[str, Any] = {}

    for name, parameter in parameters.items():
        if parameter.kind in {
            inspect.Parameter.KEYWORD_ONLY,
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
        } and name in kwargs_dict:
            supported_kwargs[name] = kwargs_dict[name]

    try:
        return callback(**supported_kwargs)
    except TypeError:
        return callback()


# =============================================================================
# Lazy Import / Bootstrap API
# =============================================================================

@lru_cache(maxsize=32)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    normalized_module_name = _normalize_text(module_name, "")
    if not normalized_module_name:
        return ()

    parts = normalized_module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_target_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=16)
def _load_optional_module(module_name: str) -> ModuleType | None:
    try:
        return importlib.import_module(module_name)
    except ModuleNotFoundError as exc:
        if _is_missing_target_module(exc, module_name):
            return None

        raise RuntimeError(
            f"Das Modul `{module_name}` konnte nicht geladen werden, "
            f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
        ) from exc
    except Exception as exc:
        raise RuntimeError(f"Das Modul `{module_name}` konnte nicht geladen werden.") from exc


@lru_cache(maxsize=1)
def _load_editor_bootstrap_module() -> ModuleType | None:
    return _load_optional_module(_EDITOR_BOOTSTRAP_MODULE_NAME)


@lru_cache(maxsize=1)
def _load_editor_inventory_module() -> ModuleType | None:
    return _load_optional_module(_EDITOR_INVENTORY_MODULE_NAME)


@lru_cache(maxsize=1)
def _resolve_editor_bootstrap_api() -> dict[str, Any]:
    module = _load_editor_bootstrap_module()
    if module is None:
        return {
            "moduleAvailable": False,
            "module": None,
            "buildContext": None,
            "buildFallbackContext": None,
            "metadataGetter": None,
        }

    def _safe_get_callable(name: str) -> Any | None:
        try:
            candidate = getattr(module, name, None)
        except Exception:
            return None
        return candidate if callable(candidate) else None

    return {
        "moduleAvailable": True,
        "module": module,
        "buildContext": _safe_get_callable("build_editor_template_context"),
        "buildFallbackContext": _safe_get_callable("build_fallback_editor_template_context"),
        "metadataGetter": _safe_get_callable("get_editor_bootstrap_package_metadata"),
    }


@lru_cache(maxsize=1)
def _resolve_editor_inventory_api() -> dict[str, Any]:
    module = _load_editor_inventory_module()
    if module is None:
        return {
            "moduleAvailable": False,
            "module": None,
            "metadataGetter": None,
            "healthGetter": None,
            "cacheClearer": None,
        }

    def _safe_get_callable(name: str) -> Any | None:
        try:
            candidate = getattr(module, name, None)
        except Exception:
            return None
        return candidate if callable(candidate) else None

    return {
        "moduleAvailable": True,
        "module": module,
        "metadataGetter": _safe_get_callable("get_editor_inventory_package_metadata"),
        "healthGetter": _safe_get_callable("get_editor_inventory_package_health"),
        "cacheClearer": _safe_get_callable("clear_editor_inventory_package_caches"),
    }


def _build_editor_bootstrap_api_metadata() -> dict[str, Any]:
    try:
        api = _resolve_editor_bootstrap_api()
    except Exception as exc:
        return {
            "moduleAvailable": False,
            "moduleName": _EDITOR_BOOTSTRAP_MODULE_NAME,
            "error": {
                "type": type(exc).__name__,
                "message": str(exc),
            },
        }

    metadata_getter = api.get("metadataGetter")
    package_metadata = None

    if callable(metadata_getter):
        try:
            package_metadata = metadata_getter()
        except Exception as exc:
            package_metadata = {
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                },
            }

    return {
        "moduleName": _EDITOR_BOOTSTRAP_MODULE_NAME,
        "moduleAvailable": api.get("moduleAvailable", False),
        "buildContextAvailable": callable(api.get("buildContext")),
        "buildFallbackContextAvailable": callable(api.get("buildFallbackContext")),
        "packageMetadata": _json_safe(package_metadata),
    }


def _build_editor_inventory_api_metadata() -> dict[str, Any]:
    try:
        api = _resolve_editor_inventory_api()
    except Exception as exc:
        return {
            "moduleAvailable": False,
            "moduleName": _EDITOR_INVENTORY_MODULE_NAME,
            "error": {
                "type": type(exc).__name__,
                "message": str(exc),
            },
        }

    metadata_getter = api.get("metadataGetter")
    package_metadata = None

    if callable(metadata_getter):
        try:
            package_metadata = _call_with_supported_kwargs(
                metadata_getter,
                {
                    "config_source": current_app.config,
                    "include_submodule_metadata": False,
                    "include_remote_health": False,
                },
            )
        except Exception as exc:
            package_metadata = {
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                },
            }

    return {
        "moduleName": _EDITOR_INVENTORY_MODULE_NAME,
        "moduleAvailable": api.get("moduleAvailable", False),
        "metadataGetterAvailable": callable(api.get("metadataGetter")),
        "healthGetterAvailable": callable(api.get("healthGetter")),
        "cacheClearerAvailable": callable(api.get("cacheClearer")),
        "packageMetadata": _json_safe(package_metadata),
    }


# =============================================================================
# Template-Auflösung
# =============================================================================

def _resolve_primary_template_name() -> str:
    return _coerce_text(
        _resolve_first_config_value(
            DEFAULT_EDITOR_TEMPLATE_NAME,
            "EDITOR_TEMPLATE_NAME",
            "VECTOPLAN_EDITOR_TEMPLATE_NAME",
            "EDITOR_PRIMARY_TEMPLATE_NAME",
        ),
        DEFAULT_EDITOR_TEMPLATE_NAME,
    )


def _resolve_fallback_template_name() -> str:
    return _coerce_text(
        _resolve_first_config_value(
            DEFAULT_EDITOR_FALLBACK_TEMPLATE_NAME,
            "EDITOR_FALLBACK_TEMPLATE_NAME",
            "VECTOPLAN_EDITOR_FALLBACK_TEMPLATE_NAME",
            "EDITOR_ERROR_TEMPLATE_NAME",
        ),
        DEFAULT_EDITOR_FALLBACK_TEMPLATE_NAME,
    )


# =============================================================================
# Library / Inventory Context Patch
# =============================================================================

def _build_library_route_hints_from_config() -> dict[str, str]:
    browser_base = _normalize_route_path(
        _resolve_first_config_value(
            DEFAULT_LIBRARY_BROWSER_BASE_URL,
            "VECTOPLAN_EDITOR_LIBRARY_BROWSER_BASE_URL",
            "EDITOR_LIBRARY_BROWSER_BASE_URL",
        ),
        DEFAULT_LIBRARY_BROWSER_BASE_URL,
    )
    inventory_route = _normalize_route_path(
        _resolve_first_config_value(
            DEFAULT_INVENTORY_ROUTE_PATH,
            "VECTOPLAN_EDITOR_INVENTORY_ROUTE_PATH",
            "EDITOR_INVENTORY_ROUTE_PATH",
        ),
        DEFAULT_INVENTORY_ROUTE_PATH,
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


def _build_library_config_from_config() -> dict[str, Any]:
    route_hints = _build_library_route_hints_from_config()

    return {
        "enabled": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_LIBRARY_ENABLED",
                "VECTOPLAN_LIBRARY_ENABLED",
            ),
            True,
        ),
        "source": _coerce_text(
            _resolve_first_config_value(
                "db",
                "VECTOPLAN_LIBRARY_SOURCE",
                "VECTOPLAN_EDITOR_LIBRARY_SOURCE",
            ),
            "db",
        ),
        "browserBaseUrl": route_hints["browserBaseUrl"],
        "inventoryRoute": route_hints["inventory"],
        "routeHints": route_hints,
        "requestTimeoutMs": _coerce_int(
            _resolve_first_config_value(
                5000,
                "VECTOPLAN_LIBRARY_REQUEST_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_LIBRARY_REQUEST_TIMEOUT_MS",
            ),
            5000,
            minimum=100,
            maximum=300_000,
        ),
        "statusTimeoutMs": _coerce_int(
            _resolve_first_config_value(
                3000,
                "VECTOPLAN_LIBRARY_STATUS_TIMEOUT_MS",
                "VECTOPLAN_EDITOR_LIBRARY_STATUS_TIMEOUT_MS",
            ),
            3000,
            minimum=100,
            maximum=300_000,
        ),
        "cacheTtlSeconds": _coerce_float(
            _resolve_first_config_value(
                5.0,
                "VECTOPLAN_LIBRARY_CLIENT_CACHE_TTL_SECONDS",
                "VECTOPLAN_EDITOR_LIBRARY_CACHE_TTL_SECONDS",
            ),
            5.0,
            minimum=0.0,
            maximum=3600.0,
        ),
        "staleCacheTtlSeconds": _coerce_float(
            _resolve_first_config_value(
                60.0,
                "VECTOPLAN_LIBRARY_CLIENT_STALE_CACHE_TTL_SECONDS",
                "VECTOPLAN_EDITOR_LIBRARY_STALE_CACHE_TTL_SECONDS",
            ),
            60.0,
            minimum=0.0,
            maximum=24 * 3600.0,
        ),
        "allowStaleCache": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_LIBRARY_CLIENT_ALLOW_STALE_CACHE",
                "VECTOPLAN_EDITOR_LIBRARY_ALLOW_STALE_CACHE",
            ),
            True,
        ),
    }


def _build_inventory_config_from_config() -> dict[str, Any]:
    library_config = _build_library_config_from_config()
    hotbar_size = _coerce_int(
        _resolve_first_config_value(
            DEFAULT_HOTBAR_SIZE,
            "VECTOPLAN_EDITOR_INVENTORY_HOTBAR_SIZE",
            "EDITOR_INVENTORY_HOTBAR_SIZE",
            "INVENTORY_HOTBAR_SIZE",
            "VECTOPLAN_EDITOR_HOTBAR_SLOTS",
        ),
        DEFAULT_HOTBAR_SIZE,
        minimum=1,
        maximum=64,
    )
    selected_slot = _coerce_int(
        _resolve_first_config_value(
            DEFAULT_SELECTED_SLOT,
            "VECTOPLAN_EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "EDITOR_INVENTORY_DEFAULT_SELECTED_SLOT",
            "INVENTORY_DEFAULT_SELECTED_SLOT",
        ),
        DEFAULT_SELECTED_SLOT,
        minimum=0,
        maximum=max(0, hotbar_size - 1),
    )

    return {
        "enabled": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_INVENTORY_ENABLED",
                "EDITOR_INVENTORY_ENABLED",
            ),
            True,
        ),
        "source": _coerce_text(
            _resolve_first_config_value(
                DEFAULT_INVENTORY_SOURCE,
                "VECTOPLAN_EDITOR_INVENTORY_SOURCE",
                "VECTOPLAN_LIBRARY_INVENTORY_SOURCE",
            ),
            DEFAULT_INVENTORY_SOURCE,
        ),
        "route": library_config["inventoryRoute"],
        "hotbarSize": hotbar_size,
        "defaultSelectedSlot": selected_slot,
        "libraryItemsLimit": _coerce_int(
            _resolve_first_config_value(
                max(32, hotbar_size),
                "VECTOPLAN_EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
                "EDITOR_INVENTORY_LIBRARY_ITEMS_LIMIT",
            ),
            max(32, hotbar_size),
            minimum=hotbar_size,
            maximum=512,
        ),
        "allowChunkPlaceableFallback": _coerce_bool(
            _resolve_first_config_value(
                False,
                "VECTOPLAN_EDITOR_ALLOW_CHUNK_PLACEABLE_FALLBACK",
                "VECTOPLAN_EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
                "EDITOR_INVENTORY_ALLOW_CHUNK_FALLBACK",
            ),
            False,
        ),
        "allowEmptyFallback": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
                "EDITOR_INVENTORY_ALLOW_EMPTY_FALLBACK",
            ),
            True,
        ),
        "iconOnly": _coerce_bool(
            _resolve_first_config_value(
                False,
                "VECTOPLAN_EDITOR_INVENTORY_ICON_ONLY",
                "EDITOR_INVENTORY_ICON_ONLY",
                "INVENTORY_ICON_ONLY",
            ),
            False,
        ),
        "scrollWrap": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_INVENTORY_SCROLL_WRAP",
                "EDITOR_INVENTORY_SCROLL_WRAP",
                "INVENTORY_SCROLL_WRAP",
            ),
            True,
        ),
        "allowPlaceAction": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
                "EDITOR_INVENTORY_ALLOW_PLACE_ACTION",
                "INVENTORY_ALLOW_PLACE_ACTION",
            ),
            True,
        ),
        "allowBreakAction": _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
                "EDITOR_INVENTORY_ALLOW_BREAK_ACTION",
                "INVENTORY_ALLOW_BREAK_ACTION",
            ),
            True,
        ),
        "forceRefreshOnBoot": _coerce_bool(
            _resolve_first_config_value(
                False,
                "VECTOPLAN_EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
                "EDITOR_INVENTORY_FORCE_REFRESH_ON_BOOT",
            ),
            False,
        ),
        "onlyLibraryItemsPlaceable": True,
        "debugGrassDirtAllowed": False,
    }


def _merge_feature_flags(existing: Any) -> dict[str, bool]:
    flags = dict(existing) if isinstance(existing, Mapping) else {}
    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()

    flags.update(
        {
            "libraryServiceEnabled": _coerce_bool(library_config.get("enabled"), True),
            "inventoryEnabled": _coerce_bool(inventory_config.get("enabled"), True),
            "libraryInventoryEnabled": inventory_config.get("source") == "library",
            "chunkPlaceableFallbackEnabled": _coerce_bool(
                inventory_config.get("allowChunkPlaceableFallback"),
                False,
            ),
            "onlyLibraryItemsPlaceable": True,
            "debugBlocksAllowedInInventory": False,
        }
    )

    return flags


def _patch_root_dataset_values(existing: Any) -> dict[str, str]:
    dataset = dict(existing) if isinstance(existing, Mapping) else {}
    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()

    dataset.update(
        {
            "library-service-enabled": "true" if library_config["enabled"] else "false",
            "library-browser-base-url": str(library_config["browserBaseUrl"]),
            "library-inventory-route": str(library_config["inventoryRoute"]),
            "inventory-enabled": "true" if inventory_config["enabled"] else "false",
            "inventory-source": str(inventory_config["source"]),
            "inventory-route": str(inventory_config["route"]),
            "inventory-hotbar-size": str(inventory_config["hotbarSize"]),
            "inventory-default-selected-slot": str(inventory_config["defaultSelectedSlot"]),
            "inventory-only-library-items-placeable": "true",
            "inventory-debug-grass-dirt-allowed": "false",
            "inventory-chunk-placeable-fallback": "true"
            if inventory_config["allowChunkPlaceableFallback"]
            else "false",
        }
    )

    return dataset


def _patch_bootstrap_payload(existing: Any) -> dict[str, Any]:
    bootstrap = _safe_deepcopy(existing) if isinstance(existing, Mapping) else {}
    if not isinstance(bootstrap, dict):
        bootstrap = {}

    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()

    runtime = bootstrap.get("runtime")
    if not isinstance(runtime, dict):
        runtime = {}

    runtime["library"] = library_config
    runtime["inventory"] = inventory_config
    runtime["featureFlags"] = _merge_feature_flags(runtime.get("featureFlags"))

    ui = runtime.get("ui")
    if not isinstance(ui, dict):
        ui = {}

    ui["hotbarSlots"] = int(inventory_config["hotbarSize"])
    ui["inventoryRoute"] = str(inventory_config["route"])
    ui["inventorySource"] = str(inventory_config["source"])
    ui["onlyLibraryItemsPlaceable"] = True

    runtime["ui"] = ui

    bootstrap["runtime"] = runtime
    bootstrap["library"] = library_config
    bootstrap["inventory"] = inventory_config
    bootstrap["featureFlags"] = _merge_feature_flags(bootstrap.get("featureFlags"))

    return bootstrap


def _patch_context_with_library_inventory(context: dict[str, Any]) -> dict[str, Any]:
    """
    Ergänzt Library-/Inventory-Kontext auch dann, wenn `src.bootstrap` diese
    neuen Felder noch nicht liefert.

    Dadurch kann die Route früher aktualisiert werden als alle Bootstrap-Module.
    """
    patched = _safe_deepcopy(context)
    if not isinstance(patched, dict):
        patched = dict(context)

    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()

    patched["library"] = library_config
    patched["library_config"] = library_config
    patched["library_route_hints"] = library_config.get("routeHints", {})
    patched["inventory"] = inventory_config
    patched["inventory_config"] = inventory_config
    patched["inventory_route"] = inventory_config["route"]
    patched["inventory_source"] = inventory_config["source"]

    patched["feature_flags"] = _merge_feature_flags(patched.get("feature_flags"))
    patched["root_dataset_values"] = _patch_root_dataset_values(patched.get("root_dataset_values"))
    patched["bootstrap_payload"] = _patch_bootstrap_payload(patched.get("bootstrap_payload"))

    # Backwards-compatible hotbar labels.
    try:
        hotbar_size = int(inventory_config["hotbarSize"])
    except Exception:
        hotbar_size = DEFAULT_HOTBAR_SIZE
    patched["hotbar_slots"] = [str(index) for index in range(1, max(1, min(hotbar_size, 64)) + 1)]

    # Wichtig: placeable_blocks dürfen nicht mehr als fachliche Inventory-Wahrheit dienen.
    if not inventory_config.get("allowChunkPlaceableFallback"):
        patched["placeable_blocks"] = []

    return patched


# =============================================================================
# Kontext-Bau
# =============================================================================

def _build_editor_context(*, force_asset_refresh: bool = False) -> dict[str, Any]:
    api = _resolve_editor_bootstrap_api()
    builder = api.get("buildContext")

    if not callable(builder):
        metadata = _build_editor_bootstrap_api_metadata()
        raise RuntimeError(
            "Die Funktion `build_editor_template_context(...)` aus `src.bootstrap` ist nicht verfügbar. "
            f"Diagnose: {metadata!r}"
        )

    try:
        context = _call_with_supported_kwargs(
            builder,
            {
                "config_source": current_app.config,
                "static_url_builder": _build_static_url,
                "include_bootstrap_payload": True,
                "includeBootstrapPayload": True,
                "include_assets": True,
                "includeAssets": True,
                "force_asset_refresh": force_asset_refresh,
                "forceAssetRefresh": force_asset_refresh,
            },
        )
    except Exception as exc:
        raise RuntimeError("Der Primärkontext für `/editor` konnte nicht gebaut werden.") from exc

    if not isinstance(context, dict):
        try:
            context = dict(context)
        except Exception as exc:
            raise TypeError("Der von `src.bootstrap` gelieferte Primärkontext ist kein Dictionary.") from exc

    return _patch_context_with_library_inventory(context)


def _salvage_fallback_context(
    *,
    reason: str,
    source_context: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not isinstance(source_context, dict):
        return None

    salvaged_context = _safe_deepcopy(source_context)
    if not isinstance(salvaged_context, dict):
        return None

    salvaged_context["fallback_active"] = True
    salvaged_context["fallback_reason"] = _coerce_text(reason, "fallback-active")

    return _patch_context_with_library_inventory(salvaged_context)


def _build_fallback_context(
    *,
    reason: str,
    source_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    api = _resolve_editor_bootstrap_api()
    builder = api.get("buildFallbackContext")

    if callable(builder):
        try:
            context = _call_with_supported_kwargs(
                builder,
                {
                    "reason": reason,
                    "source_context": source_context,
                    "sourceContext": source_context,
                    "config_source": current_app.config,
                    "static_url_builder": _build_static_url,
                    "include_bootstrap_payload": True,
                    "includeBootstrapPayload": True,
                    "include_assets": True,
                    "includeAssets": True,
                },
            )
        except Exception as exc:
            salvaged = _salvage_fallback_context(reason=reason, source_context=source_context)
            if salvaged is not None:
                _safe_log_warning(
                    "Dedizierter Fallback-Context-Builder ist fehlgeschlagen; vorhandener Primärkontext wird als Fallback verwendet: %r",
                    exc,
                )
                return salvaged
            raise RuntimeError("Der Fallback-Kontext konnte nicht gebaut werden.") from exc

        if not isinstance(context, dict):
            try:
                context = dict(context)
            except Exception as exc:
                raise TypeError("Der von `src.bootstrap` gelieferte Fallback-Kontext ist kein Dictionary.") from exc

        return _patch_context_with_library_inventory(context)

    salvaged = _salvage_fallback_context(reason=reason, source_context=source_context)
    if salvaged is not None:
        return salvaged

    metadata = _build_editor_bootstrap_api_metadata()
    raise RuntimeError(
        "Die Funktion `build_fallback_editor_template_context(...)` aus `src.bootstrap` ist nicht verfügbar "
        "und es konnte kein vorhandener Primärkontext als Fallback verwendet werden. "
        f"Diagnose: {metadata!r}"
    )


# =============================================================================
# Response-Bau
# =============================================================================

def _build_html_response(
    html: str,
    *,
    template_name: str | None = None,
    status_code: int = HTTPStatus.OK,
    fallback_reason: str | None = None,
    request_id: str | None = None,
    elapsed_ms: float | None = None,
    context: Mapping[str, Any] | None = None,
) -> Response:
    response = make_response(html, int(status_code))
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["X-VECTOPLAN-Editor-Route"] = EDITOR_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Route-Version"] = EDITOR_ROUTE_MODULE_VERSION
    response.headers["X-VECTOPLAN-Editor-Bootstrap-Module"] = _EDITOR_BOOTSTRAP_MODULE_NAME
    response.headers["X-VECTOPLAN-Editor-Inventory-Route"] = DEFAULT_INVENTORY_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Inventory-Source"] = DEFAULT_INVENTORY_SOURCE
    response.headers["X-VECTOPLAN-Editor-Inventory-Only-Library"] = "true"
    response.headers["X-VECTOPLAN-Editor-Debug-Blocks-Inventory"] = "false"

    if request_id:
        response.headers["X-VECTOPLAN-Request-Id"] = request_id
        response.headers["X-VECTOPLAN-Request-ID"] = request_id

    if elapsed_ms is not None:
        response.headers["X-VECTOPLAN-Editor-Elapsed-Ms"] = str(round(elapsed_ms, 3))

    if template_name:
        response.headers["X-VECTOPLAN-Editor-Template"] = template_name

    if fallback_reason:
        response.headers["X-VECTOPLAN-Editor-Fallback"] = fallback_reason

    if isinstance(context, Mapping):
        assets = context.get("editor_assets")
        if isinstance(assets, Mapping):
            response.headers["X-VECTOPLAN-Editor-Assets-Source"] = _coerce_text(assets.get("source"), "unknown")
            response.headers["X-VECTOPLAN-Editor-Assets-Ok"] = "true" if _coerce_bool(assets.get("ok"), False) else "false"

        chunk = context.get("chunk")
        if isinstance(chunk, Mapping):
            response.headers["X-VECTOPLAN-Editor-Chunk-Api"] = _coerce_text(chunk.get("apiBaseUrl"), "")
            response.headers["X-VECTOPLAN-Editor-Chunk-Project"] = _coerce_text(chunk.get("projectId"), "")
            response.headers["X-VECTOPLAN-Editor-Chunk-World"] = _coerce_text(chunk.get("worldId"), "")

        library = context.get("library")
        if isinstance(library, Mapping):
            response.headers["X-VECTOPLAN-Editor-Library-Enabled"] = (
                "true" if _coerce_bool(library.get("enabled"), False) else "false"
            )
            response.headers["X-VECTOPLAN-Editor-Library-Browser-Base"] = _coerce_text(
                library.get("browserBaseUrl"),
                "",
            )

        inventory = context.get("inventory")
        if isinstance(inventory, Mapping):
            response.headers["X-VECTOPLAN-Editor-Inventory-Route"] = _coerce_text(
                inventory.get("route"),
                DEFAULT_INVENTORY_ROUTE_PATH,
            )
            response.headers["X-VECTOPLAN-Editor-Inventory-Source"] = _coerce_text(
                inventory.get("source"),
                DEFAULT_INVENTORY_SOURCE,
            )

    return response


def _build_text_failure_response(
    message: str,
    *,
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR,
    fallback_reason: str | None = None,
    failure_stage: str | None = None,
    request_id: str | None = None,
    elapsed_ms: float | None = None,
) -> Response:
    response = make_response(_coerce_text(message, "VECTOPLAN Editor konnte nicht gerendert werden."), int(status_code))
    response.headers["Content-Type"] = "text/plain; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"
    response.headers["X-VECTOPLAN-Editor-Route"] = EDITOR_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Route-Version"] = EDITOR_ROUTE_MODULE_VERSION
    response.headers["X-VECTOPLAN-Editor-Bootstrap-Module"] = _EDITOR_BOOTSTRAP_MODULE_NAME
    response.headers["X-VECTOPLAN-Editor-Terminal-Failure"] = "true"
    response.headers["X-VECTOPLAN-Editor-Inventory-Route"] = DEFAULT_INVENTORY_ROUTE_PATH
    response.headers["X-VECTOPLAN-Editor-Inventory-Only-Library"] = "true"

    if request_id:
        response.headers["X-VECTOPLAN-Request-Id"] = request_id
        response.headers["X-VECTOPLAN-Request-ID"] = request_id

    if elapsed_ms is not None:
        response.headers["X-VECTOPLAN-Editor-Elapsed-Ms"] = str(round(elapsed_ms, 3))

    if fallback_reason:
        response.headers["X-VECTOPLAN-Editor-Fallback"] = fallback_reason

    if failure_stage:
        response.headers["X-VECTOPLAN-Editor-Failure-Stage"] = failure_stage

    return response


# =============================================================================
# Rendering
# =============================================================================

def _render_named_template(template_name: str, context: dict[str, Any]) -> str:
    _safe_log_debug("Versuche Template zu rendern: template=%r, route=%r", template_name, EDITOR_ROUTE_PATH)
    return render_template(template_name, **context)


def _try_render_fallback_or_text_failure(
    *,
    reason: str,
    source_context: dict[str, Any] | None,
    failure_stage: str,
    request_id: str,
    started_at: float,
) -> Response:
    fallback_template_name = _resolve_fallback_template_name()

    try:
        fallback_context = _build_fallback_context(
            reason=reason,
            source_context=source_context,
        )
        fallback_html = _render_named_template(
            fallback_template_name,
            fallback_context,
        )
        return _build_html_response(
            fallback_html,
            template_name=fallback_template_name,
            status_code=HTTPStatus.OK,
            fallback_reason=reason,
            request_id=request_id,
            elapsed_ms=_elapsed_ms(started_at),
            context=fallback_context,
        )

    except TemplateNotFound as exc:
        _safe_log_exception("Fallback-Template nicht gefunden für Route %r: %r", EDITOR_ROUTE_PATH, exc)
        return _build_text_failure_response(
            "VECTOPLAN Editor konnte nicht gerendert werden.",
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            fallback_reason=reason,
            failure_stage=f"{failure_stage}:fallback-template-not-found",
            request_id=request_id,
            elapsed_ms=_elapsed_ms(started_at),
        )

    except Exception as exc:
        _safe_log_exception("Fallback-Rendering ist fehlgeschlagen für Route %r: %r", EDITOR_ROUTE_PATH, exc)
        return _build_text_failure_response(
            "VECTOPLAN Editor konnte nicht gerendert werden.",
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            fallback_reason=reason,
            failure_stage=f"{failure_stage}:fallback-render-error",
            request_id=request_id,
            elapsed_ms=_elapsed_ms(started_at),
        )


# =============================================================================
# Öffentliche Routes
# =============================================================================

@editor_bp.route(EDITOR_ROUTE_PATH, methods=["GET", "HEAD"])
@editor_bp.route(EDITOR_ROUTE_PATH_SLASH, methods=["GET", "HEAD"])
def editor_index() -> Response:
    started_at = time.perf_counter()
    request_id = _request_id()
    primary_template_name = _resolve_primary_template_name()
    primary_context: dict[str, Any] | None = None

    force_asset_refresh = _coerce_bool(
        request.args.get("refreshAssets"),
        False,
    )

    try:
        primary_context = _build_editor_context(force_asset_refresh=force_asset_refresh)
    except Exception as exc:
        _safe_log_exception("Primärkontext für Route %r konnte nicht gebaut werden: %r", EDITOR_ROUTE_PATH, exc)
        return _try_render_fallback_or_text_failure(
            reason="context-build-error",
            source_context=primary_context,
            failure_stage="context-build",
            request_id=request_id,
            started_at=started_at,
        )

    try:
        rendered_html = _render_named_template(primary_template_name, primary_context)
        return _build_html_response(
            rendered_html,
            template_name=primary_template_name,
            status_code=HTTPStatus.OK,
            request_id=request_id,
            elapsed_ms=_elapsed_ms(started_at),
            context=primary_context,
        )

    except TemplateNotFound as exc:
        _safe_log_exception("Editor-Template nicht gefunden für Route %r: %r", EDITOR_ROUTE_PATH, exc)
        return _try_render_fallback_or_text_failure(
            reason="template-not-found",
            source_context=primary_context,
            failure_stage="primary-template-not-found",
            request_id=request_id,
            started_at=started_at,
        )

    except Exception as exc:
        _safe_log_exception("Unerwarteter Fehler beim Rendern der Editor-Route %r: %r", EDITOR_ROUTE_PATH, exc)
        return _try_render_fallback_or_text_failure(
            reason="render-error",
            source_context=primary_context,
            failure_stage="primary-render-error",
            request_id=request_id,
            started_at=started_at,
        )


# =============================================================================
# Diagnose / Cache
# =============================================================================

def get_editor_route_module_metadata() -> dict[str, Any]:
    return {
        "moduleName": "routes.editor",
        "moduleVersion": EDITOR_ROUTE_MODULE_VERSION,
        "blueprintName": EDITOR_BLUEPRINT_NAME,
        "routePath": EDITOR_ROUTE_PATH,
        "routePathSlash": EDITOR_ROUTE_PATH_SLASH,
        "defaultEditorTemplateName": DEFAULT_EDITOR_TEMPLATE_NAME,
        "defaultEditorFallbackTemplateName": DEFAULT_EDITOR_FALLBACK_TEMPLATE_NAME,
        "bootstrapModuleName": _EDITOR_BOOTSTRAP_MODULE_NAME,
        "inventoryModuleName": _EDITOR_INVENTORY_MODULE_NAME,
        "editorBootstrapApi": _build_editor_bootstrap_api_metadata(),
        "editorInventoryApi": _build_editor_inventory_api_metadata(),
        "library": _build_library_config_from_config(),
        "inventory": _build_inventory_config_from_config(),
        "rules": {
            "browserShouldUseEditorApiInventory": True,
            "browserShouldNotCallVectoplanLibraryDirectly": True,
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
            "contextPatchInjectsInventoryIfBootstrapMissingIt": True,
        },
    }


def clear_editor_route_caches() -> None:
    cache_clearers = (
        _candidate_missing_names,
        _load_optional_module,
        _load_editor_bootstrap_module,
        _load_editor_inventory_module,
        _resolve_editor_bootstrap_api,
        _resolve_editor_inventory_api,
    )

    for candidate in cache_clearers:
        try:
            candidate.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            continue

    try:
        module = _load_editor_bootstrap_module()
        if module is not None and hasattr(module, "clear_editor_bootstrap_package_caches"):
            module.clear_editor_bootstrap_package_caches()
    except Exception:
        pass

    try:
        module = _load_editor_inventory_module()
        if module is not None and hasattr(module, "clear_editor_inventory_package_caches"):
            module.clear_editor_inventory_package_caches()
    except Exception:
        pass


__all__ = [
    "EDITOR_BLUEPRINT_NAME",
    "EDITOR_ROUTE_PATH",
    "EDITOR_ROUTE_PATH_SLASH",
    "EDITOR_ROUTE_MODULE_VERSION",
    "editor_bp",
    "editor_index",
    "get_editor_route_module_metadata",
    "clear_editor_route_caches",
]
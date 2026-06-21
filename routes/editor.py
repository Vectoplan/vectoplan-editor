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
from urllib.parse import urlsplit

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

EDITOR_ROUTE_MODULE_VERSION: Final[str] = "0.7.0"

DEFAULT_LIBRARY_BROWSER_BASE_URL: Final[str] = "/editor/api/library"
DEFAULT_INVENTORY_ROUTE_PATH: Final[str] = "/editor/api/inventory"
DEFAULT_INVENTORY_SOURCE: Final[str] = "library"
DEFAULT_HOTBAR_SIZE: Final[int] = 9
DEFAULT_SELECTED_SLOT: Final[int] = 0

DEFAULT_APP_PUBLIC_URL: Final[str] = "http://localhost:5103"
DEFAULT_EDITOR_PUBLIC_URL: Final[str] = "http://localhost:5100"
DEFAULT_FRAME_ANCESTORS: Final[tuple[str, ...]] = (
    "http://localhost:5103",
    "http://127.0.0.1:5103",
)

_TRUE_VALUES: Final[set[str]] = {
    "1",
    "true",
    "t",
    "yes",
    "y",
    "on",
    "enabled",
    "ja",
}

_FALSE_VALUES: Final[set[str]] = {
    "0",
    "false",
    "f",
    "no",
    "n",
    "off",
    "disabled",
    "nein",
}


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

    if normalized in _TRUE_VALUES:
        return True

    if normalized in _FALSE_VALUES:
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

        while "//" in normalized:
            normalized = normalized.replace("//", "/")

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
# Embed / Security Helper
# =============================================================================

def _config_bool(key: str, default: bool = False) -> bool:
    return _coerce_bool(_safe_get_config_value(key, default), default)


def _config_text(key: str, default: str = "") -> str:
    return _coerce_text(_safe_get_config_value(key, default), default)


def _split_sources(value: Any, default: tuple[str, ...]) -> tuple[str, ...]:
    try:
        if isinstance(value, (list, tuple, set)):
            result: list[str] = []
            for item in value:
                text = _normalize_text(item)
                if text and text not in result:
                    result.append(text)
            return tuple(result) or default

        text = _normalize_text(value)
        if text is None:
            return default

        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                result = []
                for item in parsed:
                    item_text = _normalize_text(item)
                    if item_text and item_text not in result:
                        result.append(item_text)
                return tuple(result) or default
        except Exception:
            pass

        separators = [",", ";", "\n", "\t", " "]
        parts = [text]
        for separator in separators:
            if separator in text:
                parts = [part.strip() for part in text.replace(";", " ").replace(",", " ").split() if part.strip()]
                break

        result = []
        for part in parts:
            part_text = _normalize_text(part)
            if part_text and part_text not in result:
                result.append(part_text)

        return tuple(result) or default

    except Exception:
        return default


def _normalize_url(value: Any, default: str) -> str:
    raw = _normalize_text(value, default) or default

    try:
        normalized = raw.rstrip("/")
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
    except Exception:
        pass

    return default.rstrip("/")


def _normalize_origin(value: Any, default: str | None = None) -> str:
    raw = _normalize_text(value)

    if raw is None:
        return default or ""

    try:
        if raw in {"self", "'self'"}:
            return "'self'"

        if raw == "*":
            return ""

        if not (raw.startswith("http://") or raw.startswith("https://")):
            return default or ""

        parsed = urlsplit(raw)

        if not parsed.scheme or not parsed.netloc:
            return default or ""

        return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return default or ""


def _normalize_origins(value: Any, default: tuple[str, ...]) -> tuple[str, ...]:
    try:
        raw_values = _split_sources(value, default)
        result: list[str] = []

        for item in raw_values:
            origin = _normalize_origin(item)
            if not origin:
                continue
            if origin not in result:
                result.append(origin)

        return tuple(result) or default
    except Exception:
        return default


def _csp_source(value: Any) -> str:
    normalized = _normalize_origin(value)

    if not normalized:
        return ""

    if normalized in {"self", "'self'"}:
        return "'self'"

    return normalized


def _csp_join(values: tuple[str, ...], *, include_self: bool = False) -> str:
    try:
        result: list[str] = []

        if include_self:
            result.append("'self'")

        for item in values:
            source = _csp_source(item)
            if not source:
                continue
            if source not in result:
                result.append(source)

        return " ".join(result)
    except Exception:
        return "'self'" if include_self else ""


def _editor_public_url() -> str:
    return _normalize_url(
        _resolve_first_config_value(
            DEFAULT_EDITOR_PUBLIC_URL,
            "VECTOPLAN_EDITOR_PUBLIC_URL",
            "VECTOPLAN_EDITOR_PUBLIC_BASE_URL",
            "EDITOR_PUBLIC_URL",
            "EDITOR_PUBLIC_BASE_URL",
        ),
        DEFAULT_EDITOR_PUBLIC_URL,
    )


def _app_public_url() -> str:
    return _normalize_url(
        _resolve_first_config_value(
            DEFAULT_APP_PUBLIC_URL,
            "VECTOPLAN_APP_PUBLIC_URL",
            "VECTOPLAN_APP_PUBLIC_BASE_URL",
            "APP_PUBLIC_URL",
        ),
        DEFAULT_APP_PUBLIC_URL,
    )


def _editor_embed_enabled() -> bool:
    return _coerce_bool(
        _resolve_first_config_value(
            True,
            "VECTOPLAN_EDITOR_EMBED_ENABLED",
            "EDITOR_EMBED_ENABLED",
        ),
        True,
    )


def _embed_query_param_name() -> str:
    return _coerce_text(
        _resolve_first_config_value(
            "embed",
            "VECTOPLAN_EDITOR_EMBED_QUERY_PARAM",
            "EDITOR_EMBED_QUERY_PARAM",
        ),
        "embed",
    )


def _embed_true_values() -> set[str]:
    values = _split_sources(
        _resolve_first_config_value(
            ("1", "true", "yes", "on"),
            "VECTOPLAN_EDITOR_EMBED_QUERY_TRUE_VALUES",
            "EDITOR_EMBED_QUERY_TRUE_VALUES",
        ),
        ("1", "true", "yes", "on"),
    )

    result = {str(value).strip().lower() for value in values if str(value).strip()}
    return result or {"1", "true", "yes", "on"}


def _is_embed_request() -> bool:
    """
    True when the Editor is requested as an iframe target from vectoplan-app.

    Supported query variants:
    - ?embed=1
    - ?embed=true
    - ?allow_embed=1
    - ?iframe=1
    """
    try:
        if not _editor_embed_enabled():
            return False

        true_values = _embed_true_values()
        primary_param = _embed_query_param_name()

        candidates = [
            request.args.get(primary_param),
            request.args.get("embed"),
            request.args.get("allow_embed"),
            request.args.get("iframe"),
        ]

        for candidate in candidates:
            if candidate is None:
                continue
            if str(candidate).strip().lower() in true_values:
                return True
            if _coerce_bool(candidate, False):
                return True

        return False

    except Exception:
        return False


def _allowed_frame_ancestors() -> tuple[str, ...]:
    configured = _resolve_first_config_value(
        DEFAULT_FRAME_ANCESTORS,
        "VECTOPLAN_EDITOR_FRAME_ANCESTORS",
        "VECTOPLAN_EDITOR_ALLOWED_FRAME_PARENTS",
        "VECTOPLAN_ALLOWED_FRAME_PARENTS",
        "FRAME_ANCESTORS",
    )

    ancestors = _normalize_origins(configured, DEFAULT_FRAME_ANCESTORS)

    # App public URL is always included as defensive local default.
    app_origin = _normalize_origin(_app_public_url())
    result: list[str] = []

    for value in (app_origin, *ancestors):
        if not value:
            continue
        if value not in result:
            result.append(value)

    return tuple(result) or DEFAULT_FRAME_ANCESTORS


def _frame_ancestors_csp() -> str:
    configured = _resolve_first_config_value(
        "",
        "VECTOPLAN_EDITOR_FRAME_ANCESTORS_CSP",
        "EDITOR_FRAME_ANCESTORS_CSP",
    )

    if configured:
        text = _coerce_text(configured, "")
        if "*" not in text:
            return text

    return _csp_join(_allowed_frame_ancestors(), include_self=True)


def _x_frame_options_default() -> str:
    value = _coerce_text(
        _resolve_first_config_value(
            "SAMEORIGIN",
            "VECTOPLAN_EDITOR_X_FRAME_OPTIONS_DEFAULT",
            "EDITOR_X_FRAME_OPTIONS_DEFAULT",
        ),
        "SAMEORIGIN",
    )

    upper = value.upper()
    if upper in {"DENY", "SAMEORIGIN"}:
        return upper

    return "SAMEORIGIN"


def _content_security_policy_for_request(*, embed: bool) -> str:
    """
    Build route-level CSP.

    This route-level CSP focuses on iframe embedding. It does not try to fully
    replace application-wide CSP if app.py has one. The later app.py step may
    merge/extend these values globally.
    """
    try:
        frame_ancestors = _frame_ancestors_csp() if embed else "'self'"

        directives = [
            f"frame-ancestors {frame_ancestors}",
        ]

        # Keep existing frontend behavior intact. Only add extra sources if they
        # are explicitly configured.
        connect_src = _split_sources(
            _resolve_first_config_value(
                (),
                "VECTOPLAN_EDITOR_CSP_EXTRA_CONNECT_SRC",
                "EDITOR_CSP_EXTRA_CONNECT_SRC",
            ),
            (),
        )
        if connect_src:
            directives.append("connect-src 'self' " + _csp_join(connect_src, include_self=False))

        img_src = _split_sources(
            _resolve_first_config_value(
                (),
                "VECTOPLAN_EDITOR_CSP_EXTRA_IMG_SRC",
                "EDITOR_CSP_EXTRA_IMG_SRC",
            ),
            (),
        )
        if img_src:
            directives.append("img-src 'self' data: blob: " + _csp_join(img_src, include_self=False))

        style_src = _split_sources(
            _resolve_first_config_value(
                (),
                "VECTOPLAN_EDITOR_CSP_EXTRA_STYLE_SRC",
                "EDITOR_CSP_EXTRA_STYLE_SRC",
            ),
            (),
        )
        if style_src:
            directives.append("style-src 'self' 'unsafe-inline' " + _csp_join(style_src, include_self=False))

        script_src = _split_sources(
            _resolve_first_config_value(
                (),
                "VECTOPLAN_EDITOR_CSP_EXTRA_SCRIPT_SRC",
                "EDITOR_CSP_EXTRA_SCRIPT_SRC",
            ),
            (),
        )
        if script_src:
            directives.append("script-src 'self' 'unsafe-inline' 'unsafe-eval' " + _csp_join(script_src, include_self=False))

        return "; ".join(directive for directive in directives if directive.strip())

    except Exception:
        return f"frame-ancestors {_frame_ancestors_csp() if embed else "'self'"}"


def _apply_editor_security_headers(response: Response, *, embed: bool) -> Response:
    """
    Apply iframe-aware security headers for /editor.

    Critical behavior:
    - /editor normal: X-Frame-Options:SAMEORIGIN remains.
    - /editor?embed=1: X-Frame-Options is removed and CSP frame-ancestors
      allows vectoplan-app origins.
    """
    try:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers["X-Robots-Tag"] = "noindex, nofollow"

        if _coerce_bool(
            _resolve_first_config_value(
                True,
                "VECTOPLAN_EDITOR_CSP_ENABLED",
                "EDITOR_CSP_ENABLED",
            ),
            True,
        ):
            response.headers["Content-Security-Policy"] = _content_security_policy_for_request(embed=embed)

        if embed:
            if _coerce_bool(
                _resolve_first_config_value(
                    True,
                    "VECTOPLAN_EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
                    "EDITOR_REMOVE_X_FRAME_OPTIONS_ON_EMBED",
                ),
                True,
            ):
                try:
                    response.headers.pop("X-Frame-Options", None)
                except Exception:
                    pass
            else:
                response.headers["X-Frame-Options"] = _x_frame_options_default()
        else:
            response.headers["X-Frame-Options"] = _x_frame_options_default()

        response.headers["X-VECTOPLAN-Editor-Embed"] = "true" if embed else "false"
        response.headers["X-VECTOPLAN-Editor-Frame-Ancestors"] = _frame_ancestors_csp()

    except Exception:
        pass

    return response


def _embed_request_context() -> dict[str, Any]:
    try:
        embed = _is_embed_request()
        parent_origin = (
            request.args.get("parent_origin")
            or request.args.get("parentOrigin")
            or request.headers.get("Origin")
            or request.headers.get("Referer")
            or ""
        )

        return {
            "enabled": _editor_embed_enabled(),
            "active": embed,
            "chat_id": request.args.get("chat_id") or request.args.get("chatId") or "",
            "parent_origin": _coerce_text(parent_origin, ""),
            "app_public_url": _app_public_url(),
            "editor_public_url": _editor_public_url(),
            "frame_ancestors": _frame_ancestors_csp(),
            "x_frame_options_removed": bool(embed),
        }
    except Exception:
        return {
            "enabled": _editor_embed_enabled(),
            "active": False,
            "chat_id": "",
            "parent_origin": "",
            "app_public_url": DEFAULT_APP_PUBLIC_URL,
            "editor_public_url": DEFAULT_EDITOR_PUBLIC_URL,
            "frame_ancestors": _csp_join(DEFAULT_FRAME_ANCESTORS, include_self=True),
            "x_frame_options_removed": False,
        }


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
            "embedEnabled": _editor_embed_enabled(),
        }
    )

    return flags


def _patch_root_dataset_values(existing: Any) -> dict[str, str]:
    dataset = dict(existing) if isinstance(existing, Mapping) else {}
    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()
    embed_context = _embed_request_context()

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
            "editor-embed-enabled": "true" if embed_context.get("enabled") else "false",
            "editor-embed-active": "true" if embed_context.get("active") else "false",
            "editor-embed-chat-id": str(embed_context.get("chat_id") or ""),
            "editor-embed-parent-origin": str(embed_context.get("parent_origin") or ""),
            "editor-frame-ancestors": str(embed_context.get("frame_ancestors") or ""),
        }
    )

    return dataset


def _patch_bootstrap_payload(existing: Any) -> dict[str, Any]:
    bootstrap = _safe_deepcopy(existing) if isinstance(existing, Mapping) else {}
    if not isinstance(bootstrap, dict):
        bootstrap = {}

    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()
    embed_context = _embed_request_context()

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
    bootstrap["embed"] = embed_context
    bootstrap["featureFlags"] = _merge_feature_flags(bootstrap.get("featureFlags"))

    return bootstrap


def _patch_context_with_library_inventory(context: dict[str, Any]) -> dict[str, Any]:
    """
    Ergänzt Library-/Inventory-/Embed-Kontext auch dann, wenn `src.bootstrap`
    diese neuen Felder noch nicht liefert.
    """
    patched = _safe_deepcopy(context)
    if not isinstance(patched, dict):
        patched = dict(context)

    library_config = _build_library_config_from_config()
    inventory_config = _build_inventory_config_from_config()
    embed_context = _embed_request_context()

    patched["library"] = library_config
    patched["library_config"] = library_config
    patched["library_route_hints"] = library_config.get("routeHints", {})
    patched["inventory"] = inventory_config
    patched["inventory_config"] = inventory_config
    patched["inventory_route"] = inventory_config["route"]
    patched["inventory_source"] = inventory_config["source"]
    patched["embed"] = embed_context
    patched["editor_embed"] = embed_context
    patched["editor_public_url"] = _editor_public_url()
    patched["app_public_url"] = _app_public_url()

    patched["feature_flags"] = _merge_feature_flags(patched.get("feature_flags"))
    patched["root_dataset_values"] = _patch_root_dataset_values(patched.get("root_dataset_values"))
    patched["bootstrap_payload"] = _patch_bootstrap_payload(patched.get("bootstrap_payload"))

    try:
        hotbar_size = int(inventory_config["hotbarSize"])
    except Exception:
        hotbar_size = DEFAULT_HOTBAR_SIZE

    patched["hotbar_slots"] = [str(index) for index in range(1, max(1, min(hotbar_size, 64)) + 1)]

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
                "embed": _is_embed_request(),
                "embed_context": _embed_request_context(),
                "embedContext": _embed_request_context(),
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
                    "embed": _is_embed_request(),
                    "embed_context": _embed_request_context(),
                    "embedContext": _embed_request_context(),
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
    embed = _is_embed_request()

    response = make_response(html, int(status_code))
    response.headers["Content-Type"] = "text/html; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
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

    return _apply_editor_security_headers(response, embed=embed)


def _build_text_failure_response(
    message: str,
    *,
    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR,
    fallback_reason: str | None = None,
    failure_stage: str | None = None,
    request_id: str | None = None,
    elapsed_ms: float | None = None,
) -> Response:
    embed = _is_embed_request()

    response = make_response(_coerce_text(message, "VECTOPLAN Editor konnte nicht gerendert werden."), int(status_code))
    response.headers["Content-Type"] = "text/plain; charset=utf-8"
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
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

    return _apply_editor_security_headers(response, embed=embed)


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
        "embed": _embed_request_context() if current_app else {},
        "security": {
            "embedEnabled": _editor_embed_enabled() if current_app else True,
            "frameAncestors": _frame_ancestors_csp() if current_app else "'self' http://localhost:5103 http://127.0.0.1:5103",
            "xFrameOptionsDefault": _x_frame_options_default() if current_app else "SAMEORIGIN",
            "removeXFrameOptionsOnEmbed": True,
        },
        "rules": {
            "browserShouldUseEditorApiInventory": True,
            "browserShouldNotCallVectoplanLibraryDirectly": True,
            "onlyLibraryItemsPlaceable": True,
            "debugGrassDirtAllowed": False,
            "contextPatchInjectsInventoryIfBootstrapMissingIt": True,
            "embedRemovesXFrameOptions": True,
            "embedUsesFrameAncestorsWithoutWildcard": True,
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
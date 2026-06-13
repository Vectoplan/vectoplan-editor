# services/vectoplan-editor/app.py
"""
Flask-App-Factory für den Service `vectoplan-editor`.

Diese Datei ist bewusst robust aufgebaut, obwohl die erste Produktstufe noch sehr
klein ist. Ziel ist es, einen stabilen Startpunkt zu schaffen, ohne später bei
Wachstum die Grundstruktur umbauen zu müssen.

Verantwortung dieser Datei:
- .env-Datei defensiv laden
- passende Konfigurationsklasse auflösen
- Flask-App mit korrekten Template-/Static-Pfaden erzeugen
- Konfiguration anwenden
- optionale Konfigurationsvalidierung ausführen
- Blueprints registrieren
- optionale Startup-Hooks ausführen
- kleine Service-Metadaten am App-Objekt hinterlegen

Wichtig:
- Keine Business-Logik in dieser Datei
- Keine fachliche Editorlogik in dieser Datei
- Keine harte Abhängigkeit auf noch nicht vollständig implementierte Module
  über starre Top-Level-Imports

Wichtige Strukturentscheidung:
- Startup-Hooks werden primär aus `src.bootstrap.startup` geladen.
- Zur Abwärtskompatibilität wird optional auf `bootstrap.startup` zurückgefallen.
"""

from __future__ import annotations

import importlib
import logging
import os
import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType
from typing import Any

from dotenv import load_dotenv
from flask import Flask

from config import BaseConfig, Config, get_config_class


# -----------------------------------------------------------------------------
# Interne Konstanten
# -----------------------------------------------------------------------------

_TRUE_VALUES = {"1", "true", "t", "yes", "y", "on"}

_DEFAULT_STARTUP_MODULE_CANDIDATES = (
    "src.bootstrap.startup",
    "bootstrap.startup",
)

_ROUTE_MODULE_NAME = "routes"


# -----------------------------------------------------------------------------
# Kleine defensive Hilfsfunktionen
# -----------------------------------------------------------------------------

def _normalize_text(value: Any, default: str | None = None) -> str | None:
    """
    Normalisiert Texteingaben defensiv.

    Verhalten:
    - None -> Default
    - String -> trim
    - sonst -> str(value).strip()
    - leerer String -> Default
    """
    if value is None:
        return default

    if isinstance(value, str):
        normalized = value.strip()
        return normalized or default

    try:
        normalized = str(value).strip()
        return normalized or default
    except Exception:
        return default


def _env_flag(name: str, default: bool = False) -> bool:
    """
    Liest eine Bool-Umgebungsvariable defensiv aus.

    Ungültige oder fehlende Werte fallen auf den Default zurück.
    """
    try:
        raw_value = os.getenv(name)
    except Exception:
        return default

    normalized = _normalize_text(raw_value)
    if normalized is None:
        return default

    return normalized.lower() in _TRUE_VALUES


def _safe_log_debug(app: Flask, message: str, *args: Any) -> None:
    """
    Loggt defensiv auf Debug-Level.
    """
    try:
        app.logger.debug(message, *args)
    except Exception:
        pass


def _safe_log_info(app: Flask, message: str, *args: Any) -> None:
    """
    Loggt defensiv auf Info-Level.
    """
    try:
        app.logger.info(message, *args)
    except Exception:
        pass


def _safe_log_warning(app: Flask, message: str, *args: Any) -> None:
    """
    Loggt defensiv auf Warning-Level.
    """
    try:
        app.logger.warning(message, *args)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Pfad- und Import-Helfer
# -----------------------------------------------------------------------------

def _resolve_service_root() -> Path:
    """
    Liefert robust das Root-Verzeichnis des Services.

    Normalfall:
    app.py liegt direkt im Service-Root.

    Fallback:
    aktuelles Arbeitsverzeichnis.
    """
    try:
        return Path(__file__).resolve().parent
    except Exception:
        return Path(".").resolve()


SERVICE_ROOT = _resolve_service_root()
SRC_ROOT = SERVICE_ROOT / "src"


@lru_cache(maxsize=1)
def _ensure_service_root_on_sys_path() -> bool:
    """
    Stellt sicher, dass das Service-Root im Python-Pfad vorhanden ist.

    Warum das hilfreich ist:
    - stabile Importe von `routes`
    - stabile Importe von `src.bootstrap.startup`
    - robusteres Verhalten in lokalen Starts, Tests und WSGI-Kontexten
    """
    try:
        service_root_str = str(SERVICE_ROOT)
    except Exception:
        return False

    if not service_root_str:
        return False

    try:
        if service_root_str not in sys.path:
            sys.path.insert(0, service_root_str)
        return True
    except Exception:
        return False


def _safe_path_from_config(value: Any, fallback_name: str) -> str:
    """
    Wandelt einen konfigurierten Pfad robust in einen String um.

    Bei ungültigen oder fehlenden Werten wird auf einen sinnvollen Default
    relativ zum Service-Root zurückgefallen.
    """
    try:
        if isinstance(value, Path):
            return str(value)

        if isinstance(value, str) and value.strip():
            return value.strip()
    except Exception:
        pass

    try:
        return str(SERVICE_ROOT / fallback_name)
    except Exception:
        return fallback_name


@lru_cache(maxsize=1)
def _load_environment_file() -> bool:
    """
    Lädt eine .env-Datei defensiv und nur einmal pro Prozess.

    Warum Cache?
    - create_app() kann in Tests mehrfach aufgerufen werden
    - .env muss nicht bei jeder App-Erzeugung erneut gelesen werden
    - reduziert unnötige Wiederholung und macht den Bootstrap stabiler

    Suchreihenfolge:
    1. .env im Service-Root
    2. .env im aktuellen Arbeitsverzeichnis
    3. generischer load_dotenv-Fallback

    Rückgabe:
    - True, wenn irgendein Ladevorgang durchgeführt werden konnte
    - False, wenn kein Ladevorgang erfolgreich war
    """
    _ensure_service_root_on_sys_path()

    candidate_paths: list[Path] = []

    try:
        candidate_paths.append(SERVICE_ROOT / ".env")
    except Exception:
        pass

    try:
        candidate_paths.append(Path.cwd() / ".env")
    except Exception:
        pass

    for candidate in candidate_paths:
        try:
            if candidate.is_file():
                load_dotenv(dotenv_path=candidate, override=False)
                return True
        except Exception:
            continue

    try:
        load_dotenv(override=False)
        return True
    except Exception:
        return False


@lru_cache(maxsize=32)
def _import_module(module_name: str) -> ModuleType:
    """
    Importiert ein Modul gecacht.

    Hinweis:
    - Exceptions werden nicht gecacht
    - erfolgreiche Modulimporte werden pro Prozess wiederverwendet
    """
    return importlib.import_module(module_name)


@lru_cache(maxsize=16)
def _candidate_missing_names(module_name: str) -> tuple[str, ...]:
    """
    Liefert alle zulässigen `ModuleNotFoundError.name`-Werte für einen
    Modulpfad zurück.

    Beispiel:
    `src.bootstrap.startup` -> (`src`, `src.bootstrap`, `src.bootstrap.startup`)
    """
    parts = module_name.split(".")
    return tuple(".".join(parts[:index]) for index in range(1, len(parts) + 1))


def _is_missing_candidate_module(exc: ModuleNotFoundError, module_name: str) -> bool:
    """
    Prüft, ob ein ModuleNotFoundError wirklich bedeutet, dass das gewünschte
    Zielmodul selbst fehlt und nicht eine tieferliegende Abhängigkeit.
    """
    missing_name = _normalize_text(getattr(exc, "name", None))
    if missing_name is None:
        return False

    return missing_name in _candidate_missing_names(module_name)


@lru_cache(maxsize=1)
def _get_startup_module_candidates() -> tuple[str, ...]:
    """
    Liefert die zu prüfenden Startup-Module in Prioritätsreihenfolge.

    Priorität:
    1. optionaler ENV-Override `VECTOPLAN_EDITOR_STARTUP_MODULE`
    2. `src.bootstrap.startup`
    3. `bootstrap.startup` als Fallback
    """
    candidates: list[str] = []

    env_candidate = _normalize_text(os.getenv("VECTOPLAN_EDITOR_STARTUP_MODULE"))
    if env_candidate:
        candidates.append(env_candidate)

    for default_candidate in _DEFAULT_STARTUP_MODULE_CANDIDATES:
        if default_candidate not in candidates:
            candidates.append(default_candidate)

    return tuple(candidates)


# -----------------------------------------------------------------------------
# Konfigurationsauflösung und Validierung
# -----------------------------------------------------------------------------

def _resolve_config_class(config_object: type[BaseConfig] | str | None) -> type[BaseConfig]:
    """
    Löst robust die zu verwendende Konfigurationsklasse auf.

    Unterstützte Eingaben:
    - None: Default-Auflösung über get_config_class()
    - str: Name einer Konfiguration wie "development", "testing", "production"
    - Klassenobjekt: direkte Nutzung

    Fallback:
    - Config
    """
    if config_object is None:
        try:
            return get_config_class()
        except Exception:
            return Config

    if isinstance(config_object, str):
        try:
            return get_config_class(config_object)
        except Exception:
            return Config

    if isinstance(config_object, type):
        return config_object

    return Config


def _validate_config(config_class: type[BaseConfig], logger: logging.Logger) -> None:
    """
    Führt optionale Konfigurationsvalidierung aus.

    Verhalten:
    - wenn `validate()` existiert, werden Fehlermeldungen gesammelt
    - standardmäßig werden Fehler geloggt, aber die App startet weiter
    - mit ENV `VECTOPLAN_EDITOR_FAIL_FAST_CONFIG=true` wird hart abgebrochen
    """
    validator = getattr(config_class, "validate", None)
    if not callable(validator):
        return

    try:
        errors = validator()
    except Exception as exc:
        errors = [f"Konfigurationsvalidierung ist mit einem Fehler abgebrochen: {exc!r}"]

    if not errors:
        return

    message = " | ".join(str(error) for error in errors if error)

    if _env_flag("VECTOPLAN_EDITOR_FAIL_FAST_CONFIG", default=False):
        raise RuntimeError(f"Ungültige Konfiguration für vectoplan-editor: {message}")

    try:
        logger.warning("Konfigurationswarnung für vectoplan-editor: %s", message)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Flask-Erzeugung und Basiskonfiguration
# -----------------------------------------------------------------------------

def _create_flask_app(config_class: type[BaseConfig]) -> Flask:
    """
    Erzeugt die Flask-Anwendung mit robust aufgelösten Pfaden.

    Template- und Static-Verzeichnisse werden explizit gesetzt, damit die
    Verzeichnisstruktur klar und stabil bleibt.
    """
    template_folder = _safe_path_from_config(
        getattr(config_class, "TEMPLATES_ROOT", None),
        "templates",
    )
    static_folder = _safe_path_from_config(
        getattr(config_class, "STATIC_ROOT", None),
        "static",
    )

    try:
        app = Flask(
            __name__,
            template_folder=template_folder,
            static_folder=static_folder,
            static_url_path="/static",
        )
    except Exception as exc:
        raise RuntimeError(
            "Flask-App konnte nicht erstellt werden. "
            f"template_folder={template_folder!r}, static_folder={static_folder!r}"
        ) from exc

    return app


def _apply_config(app: Flask, config_class: type[BaseConfig]) -> None:
    """
    Wendet die Konfiguration auf die Flask-App an.

    Zusätzliche Metadaten werden in app.extensions hinterlegt, damit spätere
    Komponenten kontrolliert auf Service-Infos zugreifen können.
    """
    try:
        app.config.from_object(config_class)
    except Exception as exc:
        raise RuntimeError(
            f"Konfigurationsklasse {config_class.__name__} konnte nicht geladen werden."
        ) from exc

    app.extensions.setdefault("vectoplan_editor", {})
    metadata = app.extensions["vectoplan_editor"]

    metadata["service_name"] = app.config.get("APP_NAME", "vectoplan-editor")
    metadata["service_display_name"] = app.config.get("APP_DISPLAY_NAME", "VECTOPLAN Editor")
    metadata["config_class_name"] = config_class.__name__
    metadata["service_root"] = str(SERVICE_ROOT)
    metadata["src_root"] = str(SRC_ROOT)
    metadata["service_root_on_sys_path"] = _ensure_service_root_on_sys_path()
    metadata["dotenv_loaded"] = _load_environment_file()
    metadata["startup_completed"] = False
    metadata["startup_attempted"] = False
    metadata["startup_module_name"] = None
    metadata["startup_hook_name"] = None
    metadata["startup_skipped"] = False
    metadata["blueprints_registered"] = False


def _configure_app_defaults(app: Flask) -> None:
    """
    Setzt kleine, sinnvolle App-Defaults.

    Diese Einstellungen sind bewusst zurückhaltend und zielen auf sauberes
    Verhalten im lokalen Minimalbetrieb.
    """
    try:
        app.json.sort_keys = False
    except Exception:
        pass

    try:
        app.url_map.strict_slashes = False
    except Exception:
        pass


def _configure_logger(app: Flask) -> None:
    """
    Stellt sicher, dass die App einen brauchbaren Logger-Zustand hat.

    Flask bringt bereits Logging mit. Diese Funktion sorgt nur dafür, dass
    das Level zur aktuellen Umgebung passt und keine harte Exception entsteht.
    """
    try:
        if app.debug:
            app.logger.setLevel(logging.DEBUG)
        else:
            app.logger.setLevel(logging.INFO)
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Blueprint-Registrierung
# -----------------------------------------------------------------------------

def _register_blueprints(app: Flask) -> None:
    """
    Importiert die Routen defensiv und registriert sie.

    Wichtig:
    - kein Top-Level-Import von `routes`, damit app.py bereits existieren kann,
      bevor alle Dateien vollständig umgesetzt sind
    - klarer Fehlertext, falls `register_blueprints()` fehlt
    """
    _ensure_service_root_on_sys_path()

    try:
        routes_module = _import_module(_ROUTE_MODULE_NAME)
    except Exception as exc:
        raise RuntimeError(
            "Das Modul `routes` konnte nicht importiert werden. "
            "Prüfe, ob `services/vectoplan-editor/routes/__init__.py` existiert."
        ) from exc

    register_function = getattr(routes_module, "register_blueprints", None)
    if not callable(register_function):
        raise RuntimeError(
            "Im Modul `routes` fehlt eine aufrufbare Funktion `register_blueprints(app)`."
        )

    try:
        register_function(app)
    except Exception as exc:
        raise RuntimeError("Die Blueprint-Registrierung ist fehlgeschlagen.") from exc

    try:
        app.extensions["vectoplan_editor"]["blueprints_registered"] = True
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Optionale Startup-Hooks
# -----------------------------------------------------------------------------

def _resolve_startup_module(app: Flask) -> tuple[ModuleType | None, str | None]:
    """
    Löst das bevorzugte Startup-Modul robust auf.

    Reihenfolge:
    1. optionaler ENV-Override
    2. `src.bootstrap.startup`
    3. `bootstrap.startup`

    Verhalten:
    - fehlt ein Kandidat selbst, wird der nächste probiert
    - schlägt ein Kandidat wegen einer tieferen Importabhängigkeit fehl, wird
      hart abgebrochen, da das ein echter Fehler ist
    """
    _ensure_service_root_on_sys_path()

    candidates = _get_startup_module_candidates()

    try:
        app.extensions.setdefault("vectoplan_editor", {})
        app.extensions["vectoplan_editor"]["startup_module_candidates"] = list(candidates)
    except Exception:
        pass

    for module_name in candidates:
        try:
            module = _import_module(module_name)
            return module, module_name
        except ModuleNotFoundError as exc:
            if _is_missing_candidate_module(exc, module_name):
                _safe_log_debug(
                    app,
                    "Startup-Modul `%s` nicht gefunden; nächster Kandidat wird geprüft.",
                    module_name,
                )
                continue

            raise RuntimeError(
                f"Das Startup-Modul `{module_name}` konnte nicht geladen werden, "
                f"weil eine innere Abhängigkeit fehlt: {exc.name!r}."
            ) from exc
        except Exception as exc:
            raise RuntimeError(
                f"Das Startup-Modul `{module_name}` konnte nicht geladen werden."
            ) from exc

    return None, None


def _run_optional_startup_hooks(app: Flask) -> None:
    """
    Führt optional vorhandene Startup-Hooks aus.

    Unterstützte Funktionsnamen:
    - run_startup(app)
    - bootstrap_app(app)
    - initialize_app(app)

    Primärer Modulpfad:
    - src.bootstrap.startup

    Fallback-Modulpfad:
    - bootstrap.startup

    Verhalten:
    - wenn kein Modul gefunden wird, wird der Schritt still übersprungen
    - wenn das Modul existiert, aber keine bekannte Funktion enthält, wird nur
      ein Debug-Hinweis geloggt
    - wenn eine Startup-Funktion fehlschlägt, wird bewusst hart abgebrochen,
      damit inkonsistente Zustände vermieden werden
    """
    metadata = app.extensions.setdefault("vectoplan_editor", {})
    metadata["startup_attempted"] = True

    startup_module, module_name = _resolve_startup_module(app)

    if startup_module is None or module_name is None:
        metadata["startup_skipped"] = True
        _safe_log_debug(
            app,
            "Kein Startup-Modul gefunden; geprüfte Kandidaten: %s",
            ", ".join(_get_startup_module_candidates()),
        )
        return

    metadata["startup_module_name"] = module_name

    startup_function = None
    startup_function_name = None

    for function_name in ("run_startup", "bootstrap_app", "initialize_app"):
        candidate = getattr(startup_module, function_name, None)
        if callable(candidate):
            startup_function = candidate
            startup_function_name = function_name
            break

    if startup_function is None:
        metadata["startup_skipped"] = True
        _safe_log_debug(
            app,
            "Startup-Modul `%s` gefunden, aber keine bekannte Startup-Funktion definiert.",
            module_name,
        )
        return

    metadata["startup_hook_name"] = startup_function_name

    try:
        startup_function(app)
    except Exception as exc:
        raise RuntimeError(
            f"Startup-Hooks des Editors sind fehlgeschlagen (module={module_name}, hook={startup_function_name})."
        ) from exc

    try:
        metadata["startup_completed"] = True
        metadata["startup_skipped"] = False
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Öffentliche App-Factory
# -----------------------------------------------------------------------------

def create_app(config_object: type[BaseConfig] | str | None = None) -> Flask:
    """
    Öffentliche Flask-App-Factory.

    Beispiel:
        app = create_app()
        app = create_app("testing")
        app = create_app(TestingConfig)

    Ablauf:
    1. Service-Root in sys.path sicherstellen
    2. .env laden
    3. Konfigurationsklasse auflösen
    4. Flask-App erzeugen
    5. Konfiguration anwenden
    6. Logger/App-Defaults setzen
    7. Konfiguration validieren
    8. Blueprints registrieren
    9. optionale Startup-Hooks ausführen

    Rückgabe:
    - vollständig erzeugte Flask-App
    """
    _ensure_service_root_on_sys_path()
    _load_environment_file()

    config_class = _resolve_config_class(config_object)
    app = _create_flask_app(config_class)

    _apply_config(app, config_class)
    _configure_app_defaults(app)
    _configure_logger(app)

    _validate_config(config_class, app.logger)
    _register_blueprints(app)

    with app.app_context():
        _run_optional_startup_hooks(app)

    _safe_log_info(
        app,
        "Flask-App `%s` wurde erfolgreich initialisiert (config=%s, startup_module=%s).",
        app.config.get("APP_NAME", "vectoplan-editor"),
        config_class.__name__,
        app.extensions.get("vectoplan_editor", {}).get("startup_module_name"),
    )

    return app


__all__ = ["create_app"]
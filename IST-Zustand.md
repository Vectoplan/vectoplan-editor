# VECTOPLAN Editor – IST-Zustand

<!-- services/vectoplan-editor/IST-Zustand.md -->

## 0. Datei

```text
Ordner: services/vectoplan-editor
Datei: IST-Zustand.md
Pfad: services/vectoplan-editor/IST-Zustand.md
Stand: nach funktionierender Fullscreen-Remote-Chunk-Runtime mit Hotbar/Inventory, Crosshair, Pointer Lock, Minecraft-/Hytale-Maussteuerung, korrigierter WASD-Steuerung, bestätigtem Place/Remove, aktivem Player-Physics-System, Block-Collision und Doppel-Leertaste-Flugmodus
```

Dieses Dokument beschreibt den aktuellen technischen IST-Zustand des Services:

```text
services/vectoplan-editor
```

Die produktive Frontend-Wahrheit liegt weiterhin unter:

```text
services/vectoplan-editor/src/frontend
```

Wichtig nach der letzten Reparaturrunde:

```text
Die aktive SceneRuntime liegt unter:
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts

Nicht unter:
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Die Datei unter `src/frontend/runtime/scene/scene_runtime.ts` kann noch existieren, ist aber nicht die aktuell im Browser genutzte Runtime. Die Browser-Console zeigte eindeutig, dass die aktive Runtime-API Methoden wie `renderOnce`, `getRenderer`, `getScene`, `getCamera` und `getUiRuntime` besitzt. Diese Signatur gehört zu `src/frontend/scene/scene_runtime.ts`.

---

## 1. Aktueller Hauptbefund

Der `vectoplan-editor` läuft aktuell als Remote-Chunk-Service-Editor mit spielbarer First-Person-/Builder-Runtime. Der aktuelle Browser-Stand ist funktional bestätigt:

```text
http://localhost:5000/editor
→ Editor lädt
→ Fullscreen-Canvas füllt den Viewport
→ Chunk-Service ist verbunden
→ Welt/Chunk-Fläche wird gerendert
→ sichtbare Blöcke erscheinen im Viewport
→ mittiges Crosshair ist vorhanden
→ Pointer Lock funktioniert
→ Maus bewegt die Kamera ohne gedrückte Maustaste wie in Minecraft/Hytale
→ W/A/S/D-Steuerung ist korrekt
→ Hotbar/Inventory ist sichtbar und funktioniert
→ Mausrad wechselt Hotbar-Slots
→ Linksklick setzt Blöcke
→ Rechtsklick entfernt Blöcke
→ Player-Physics ist aktiv
→ Builder/Spieler kann nicht mehr durch solide Blöcke fliegen/laufen
→ Doppel-Leertaste aktiviert Flugmodus
→ erneute Doppel-Leertaste deaktiviert Flugmodus
→ nach Flugmodus-Aus fällt der Spieler wieder nach unten
```

Der aktuelle produktive Datenpfad ist:

```text
Browser Runtime
→ /editor/api/chunk/...
→ vectoplan-editor Backend-Proxy
→ services/vectoplan-editor/src/clients/chunk_client.py
→ vectoplan-chunk
→ PostgreSQL ChunkSnapshot / ChunkEvent / WorldCommandLog
→ dirtyChunks zurück
→ Editor lädt/remesht bestätigten Zustand
```

Der aktuelle Verantwortungszuschnitt lautet:

```text
Editor:
- rendert sichtbare Chunks
- targetet mit Crosshair
- steuert Kamera/Player
- verwaltet Hotbar/Inventory
- sendet SetBlock/RemoveBlock Commands
- simuliert lokale Player-Physics gegen Chunk-Collision

Chunk-Service:
- lädt Chunks
- speichert Snapshots
- schreibt Events
- schreibt CommandLogs
- meldet Dirty-Chunks zurück
```

---

## 2. Bestätigter Browser- und Runtime-Stand

### 2.1 Backend/Build

```text
- vectoplan-editor Container baut erfolgreich
- Gunicorn startet
- /editor liefert die Editor-Seite aus
- /editor/api/chunk ist als Browser-Pfad angebunden
- Chunk-Service-Verbindung wird im Browser als verbunden angezeigt
- /editor/api/chunk/placeable-blocks liefert die aktuelle Inventory-/Hotbar-Liste
- /editor/api/chunk/projects/<project>/worlds/<world>/blocks bleibt der Pfad für den vollständigen Blockkatalog / spätere Creative Library
```

### 2.2 Frontend

```text
- neue Frontend-Quelle liegt unter services/vectoplan-editor/src/frontend
- TypeScript-Typecheck läuft nach den Korrekturen durch
- Vite-Build erzeugt static/editor/manifest.json und hashed Assets
- Flask/Jinja lädt Assets aus dem Manifest
- Browser lädt das gebaute Modul
- Runtime startet sichtbar
- Fullscreen-Viewport funktioniert
- Canvas füllt den Browser-Viewport
- Crosshair liegt in der Bildschirmmitte
- Hotbar ist sichtbar und zeigt Slots 1–9
- Hotbar-Slots werden aus dem Backend-/Chunk-Service-Inventory befüllt
- debug_grass und debug_dirt sind auswählbar
- leere Slots bleiben sichtbar als leere Slots
- Mausrad wechselt Slots
- Pointer Lock funktioniert nach Klick in den Viewport
- Kamera folgt der Maus ohne gedrückte Maustaste
- Linksklick setzt Blöcke
- Rechtsklick entfernt Blöcke
- WASD läuft korrekt:
  - W = vorwärts
  - S = rückwärts
  - A = links
  - D = rechts
```

### 2.3 Physics/Collision

```text
- runtime.physics.enabled = true
- featureFlags.physicsEnabled = true
- featureFlags.playerCollisionEnabled = true
- featureFlags.flightModeEnabled = true
- camera.physicsFollowEnabled = true
- camera.directMovementEnabled = false
- WorldRuntime liefert Collision-Zellen
- solide Chunk-Zellen werden als solid:true erkannt
- Spieler/Builder kann nicht mehr durch Blöcke fliegen/laufen
- Doppel-Leertaste toggelt Flugmodus
- erneute Doppel-Leertaste beendet Flugmodus
- nach Flugmodus-Aus wirkt Schwerkraft wieder
```

Bestätigte Collision-Probe aus dem Browser-Kontext:

```text
cell 8,7,18
→ loaded: true
→ solid: true
→ kind: solid
→ blockTypeId: debug_grass
```

---

### 2.4 Was der Editor aktuell kann

Aktuell ist der Editor nicht nur ein Chunk-Viewer, sondern eine spielbare Builder-Runtime mit Remote-Persistenzpfad.

```text
Rendering / Viewport
- /editor startet als Fullscreen-Editor.
- Canvas füllt den Browser-Viewport.
- Vite-Assets werden aus static/editor/manifest.json geladen.
- sichtbare Chunks werden als Three.js InstancedMesh-Gruppen gerendert.
- Chunk-Reloads und Dirty-Chunk-Updates werden im Browser neu gerendert.
- Crosshair bleibt zentral und wird über Targeting-State eingefärbt/validiert.

Kamera / First Person
- Klick in den Viewport aktiviert Pointer Lock.
- Mausbewegung steuert die Kamera ohne gedrückte Maustaste.
- ESC löst Pointer Lock.
- W/A/S/D bewegt den Builder korrekt relativ zur Blickrichtung.
- Shift sprintet.
- Kamera folgt bei aktiver Physics dem Player-Eye-Point.

Player Physics
- lokales AABB-Player-Physics-System ist aktiv.
- Collision gegen geladene Chunk-Zellen ist aktiv.
- solide Non-Air-Zellen blockieren Bewegung.
- unbekannte/missing Collision kann fail-closed behandelt werden.
- Gravity wirkt nach Flugmodus-Aus.
- Double-Space toggelt Flugmodus.
- erneuter Double-Space beendet Flugmodus.
- Spieler fällt danach wieder Richtung Boden.

Block-Interaktion
- Raycast/Targeting erkennt Blockflächen im Crosshair.
- Linksklick setzt den ausgewählten Block.
- Rechtsklick entfernt den getroffenen Block.
- SetBlock/RemoveBlock laufen über den Chunk-Service-Command-Pfad.
- Dirty-Chunks werden nach Commands neu geladen und neu gerendert.

Inventory / Hotbar
- Hotbar mit 9 Slots ist sichtbar.
- aktive Slots kommen aus /editor/api/chunk/placeable-blocks.
- debug_grass und debug_dirt sind aktuell auswählbar.
- leere Slots bleiben sichtbar.
- Mausrad rotiert auswählbare Slots.
- Auswahl wird in Store, DOM und Targeting synchronisiert.

Remote Chunk Service
- Browser spricht nur mit /editor/api/chunk.
- vectoplan-editor proxyt serverseitig zu vectoplan-chunk.
- Chunks werden initial und positionsabhängig geladen.
- Batch-Loading ist vorgesehen/aktiv im Loader.
- Commands schreiben über vectoplan-chunk in Snapshot/Event/CommandLog-Strukturen.

Debug / Diagnose
- Store-Snapshots sind über Runtime-Handles erreichbar.
- SceneRuntime-Snapshot zeigt Status, Render-Counter, Chunks, Input, UI und Physics.
- Collision kann über WorldRuntime direkt geprüft werden.
- DOM-Dataset zeigt InputController-Status und Flight-Toggle-Zeitpunkt.
```

Funktionsmatrix:

| Bereich | Kann aktuell | Bestätigt | Bemerkung |
|---|---:|---:|---|
| Editor-Seite `/editor` | ja | ja | Flask/Jinja + Vite Manifest |
| Fullscreen-Canvas | ja | ja | Viewport füllend |
| Remote Chunk Loading | ja | ja | über `/editor/api/chunk` |
| Chunk Rendering | ja | ja | Three.js InstancedMesh |
| Pointer Lock | ja | ja | Klick in Viewport |
| Maus-Look | ja | ja | Minecraft/Hytale-artig |
| WASD | ja | ja | W/S-Fix im InputController |
| Hotbar | ja | ja | 9 Slots |
| Mausrad Slotwechsel | ja | ja | zentrale Input-Schicht |
| SetBlock | ja | ja | Linksklick |
| RemoveBlock | ja | ja | Rechtsklick |
| Dirty Reload/Remesh | ja | ja | nach Commands |
| Physics Runtime | ja | ja | aktive SceneRuntime |
| Player Collision | ja | ja | solide Blöcke blockieren |
| Flight Toggle | ja | ja | Doppel-Leertaste |
| Fall nach Flight-Off | ja | ja | Gravity aktiv |
| Creative-Library-UI | vorbereitet | nein | blocks-Katalog vorhanden, UI fehlt |
| Persistenz nach Reload | wahrscheinlich | offen | separat testen |
| E2E Tests | nein | offen | Playwright o. ä. später |

---

## 3. Harte Pfadentscheidung

Der alte Ordner:

```text
services/vectoplan-editor/frontend
```

ist nicht mehr die produktive Frontend-Wahrheit.

Neue Quelle:

```text
services/vectoplan-editor/src/frontend
```

Zusätzliche wichtige SceneRuntime-Entscheidung:

```text
Aktiv genutzt:
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts

Nicht aktiv für Browser-Runtime:
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Der alte Ordner und verwaiste Runtime-Dateien können gelöscht oder zusammengeführt werden, sobald keine produktiven Imports, Build-Scripts, Docker-Steps, Templates oder ENV-Werte mehr darauf zeigen.

Prüfung:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend|vectoplan-editor/frontend" services/vectoplan-editor .
rg -n "runtime/scene/scene_runtime|from .*runtime/scene|@runtime/scene" services/vectoplan-editor/src/frontend
rg -n "renderOnce|getUiRuntime" services/vectoplan-editor/src/frontend
```

PowerShell-Variante:

```powershell
Get-ChildItem ".\services\vectoplan-editor\src\frontend" -Recurse -Include *.ts,*.tsx |
  Select-String "renderOnce|getUiRuntime" |
  Format-List Path,LineNumber,Line
```

Akzeptanz:

```text
Produktive SceneRuntime ist eindeutig src/frontend/scene/scene_runtime.ts.
Keine produktiven Pfade zeigen mehr auf services/vectoplan-editor/frontend.
```

---

## 4. Umfangreiche Ordner- und File-Struktur unter `src/frontend`

Die produktive Frontend-Wahrheit liegt unter:

```text
services/vectoplan-editor/src/frontend
```

Die aktuell aktive Browser-SceneRuntime liegt unter:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Nicht verwechseln mit:

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

Diese zweite Datei kann noch im Baum liegen, ist aber aktuell nicht die Runtime, die im Browser die Methoden `renderOnce`, `getRenderer`, `getScene`, `getCamera` und `getUiRuntime` bereitstellt.

### 4.1 Gesamtstruktur

```text
services/vectoplan-editor/
├── Dockerfile
├── entrypoint.sh
├── pyproject.toml / requirements / service-Konfiguration
├── routes/
│   ├── editor.py
│   └── chunk.py
├── src/
│   ├── clients/
│   │   └── chunk_client.py
│   └── frontend/
│       ├── api/
│       │   ├── chunk_api_client.ts
│       │   ├── chunk_api_errors.ts
│       │   ├── chunk_api_models.ts
│       │   ├── chunk_api_normalize.ts
│       │   └── http_client.ts
│       ├── bootstrap/
│       │   ├── bootstrap_models.ts
│       │   ├── default_bootstrap.ts
│       │   ├── normalize_bootstrap.ts
│       │   └── read_bootstrap.ts
│       ├── camera/
│       │   ├── camera_movement_math.ts
│       │   ├── camera_state.ts
│       │   └── first_person_camera_controller.ts
│       ├── config/
│       │   └── runtime_config.ts
│       ├── dom/
│       │   ├── dom_refs.ts
│       │   └── resize_observer.ts
│       ├── input/
│       │   ├── double_tap_detector.ts?            # falls separat vorhanden, sonst unter runtime/physics
│       │   ├── input_controller.ts
│       │   ├── input_state.ts
│       │   ├── keyboard_input.ts
│       │   ├── mouse_input.ts
│       │   └── pointer_lock.ts
│       ├── inventory/
│       │   ├── chunk_inventory_source.ts
│       │   ├── hotbar_controller.ts
│       │   ├── inventory_models.ts
│       │   ├── inventory_selection.ts
│       │   └── inventory_slot_factory.ts
│       ├── render/
│       │   ├── chunk_mesher.ts
│       │   ├── chunk_scene.ts
│       │   ├── debug_overlay.ts
│       │   ├── preview_renderer.ts
│       │   └── three_context.ts
│       ├── runtime/
│       │   ├── physics/
│       │   │   ├── block_collision_query.ts
│       │   │   ├── double_tap_detector.ts
│       │   │   ├── physics_defaults.ts
│       │   │   ├── physics_models.ts
│       │   │   ├── physics_runtime.ts
│       │   │   ├── player_physics_controller.ts
│       │   │   └── voxel_collision_solver.ts
│       │   ├── scene/
│       │   │   ├── scene_chunk_tools.ts
│       │   │   ├── scene_lifecycle.ts
│       │   │   ├── scene_loop.ts
│       │   │   ├── scene_runtime.ts              # aktuell nicht die aktive Browser-Runtime
│       │   │   └── scene_world_bridge.ts
│       │   └── world/
│       │       ├── chunk_content.ts
│       │       ├── chunk_coordinates.ts
│       │       ├── chunk_edit_session.ts
│       │       ├── chunk_loader.ts
│       │       ├── chunk_registry.ts
│       │       ├── chunk_service_source.ts
│       │       ├── chunk_source.ts
│       │       └── world_runtime.ts
│       ├── scene/
│       │   └── scene_runtime.ts                  # aktive Browser-Runtime
│       ├── state/
│       │   ├── editor_state.ts
│       │   ├── editor_store.ts
│       │   ├── player_state.ts
│       │   ├── state_actions.ts
│       │   └── state_selectors.ts
│       ├── targeting/
│       │   └── chunk_targeting.ts
│       ├── ui/
│       │   ├── crosshair_view.ts
│       │   ├── debug_overlay.ts
│       │   ├── editor_ui_runtime.ts
│       │   ├── error_panel.ts
│       │   ├── hotbar_view.ts
│       │   ├── loading_overlay.ts
│       │   └── status_bar.ts
│       ├── utils/
│       │   ├── ids.ts
│       │   ├── logger.ts
│       │   ├── safe.ts
│       │   └── time.ts
│       ├── main.ts
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── scripts/
├── static/
│   └── editor/
│       ├── manifest.json
│       └── assets/
└── templates/
    └── editor/
        ├── index.html
        └── partials/
            ├── bootstrap_scripts.html
            └── head.html
```

### 4.2 Aktive Laufzeitpfade

```text
Browser Entry
→ src/frontend/main.ts
→ Bootstrap lesen/normalisieren
→ EditorRuntime erstellen
→ WorldRuntime erstellen
→ aktive SceneRuntime aus src/frontend/scene/scene_runtime.ts starten
→ InputController + UI + Three.js Renderer + WorldRegistry + PhysicsRuntime verbinden
```

Aktiver Scene-Pfad:

```text
src/frontend/scene/scene_runtime.ts
```

Aufgaben dieser aktiven Datei:

```text
- Three.js WebGLRenderer erzeugen
- Three.js Scene erzeugen
- PerspectiveCamera erzeugen
- Chunks als InstancedMesh rendern
- ResizeObserver anbinden
- EditorUiRuntime starten
- InputController starten
- WorldRuntime initialisieren
- ChunkSource abonnieren
- Targeting über Raycaster aktualisieren
- Place/Remove an WorldRuntime/ChunkSource weiterreichen
- Player Physics erzeugen und pro Frame updaten
- Kamera an Physics-Eye-Position binden
- Store mit Camera/Render/Player/Input/UI-Zustand synchronisieren
```

Aktiver World-/Data-Pfad:

```text
scene/scene_runtime.ts
→ worldRuntime.initialize()
→ runtime/world/world_runtime.ts
→ runtime/world/chunk_service_source.ts
→ api/chunk_api_client.ts
→ /editor/api/chunk
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
```

Aktiver Physics-Pfad:

```text
input/input_controller.ts
→ movementIntent.physics
→ scene/scene_runtime.ts
→ runtime/physics/physics_runtime.ts
→ runtime/physics/player_physics_controller.ts
→ runtime/physics/voxel_collision_solver.ts
→ runtime/physics/block_collision_query.ts
→ worldRuntime.getBlockCollisionQuery()
→ chunk_registry.ts / chunk_content.ts
```

### 4.3 Datei-für-Datei-Beschreibung

#### 4.3.1 Entry und Build

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `main.ts` | Frontend-Einstieg für Vite/Browser | Bootstrap lesen, Runtime starten, globale Runtime-Handles setzen |
| `package.json` | NPM-Scripts und Abhängigkeiten | typecheck/build/dev/verify, Three.js als Runtime-Abhängigkeit |
| `tsconfig.json` | TypeScript-Konfiguration | Aliase/Strictness für Frontend-Build |
| `vite.config.ts` | Vite-Build-Konfiguration | Manifest erzeugen, Assets nach `static/editor` bauen |
| `scripts/*` | Hilfsscripts | Build-/Verify-Hilfen je nach vorhandenem Script |

#### 4.3.2 API-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `api/chunk_api_models.ts` | Vertragsmodelle Browser ↔ Proxy ↔ Chunk-Service | Status, Blocks, PlaceableBlocks, Chunks, Commands, Errors modellieren |
| `api/chunk_api_errors.ts` | Einheitliche API-Fehler | Netzwerk-/HTTP-/Payload-/Timeout-/Command-Fehler normalisieren |
| `api/http_client.ts` | Fetch-Wrapper | JSON laden, Timeout/Abort, strukturierte Fehler liefern |
| `api/chunk_api_normalize.ts` | Payload-Normalisierung | Blocks/PlaceableBlocks/Chunk/Batch/Command robust normalisieren |
| `api/chunk_api_client.ts` | Browser-Chunk-Client | Status, Connection-Test, Blocks, PlaceableBlocks, Chunks, Batch, SetBlock, RemoveBlock |

#### 4.3.3 Bootstrap und Runtime-Config

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `bootstrap/bootstrap_models.ts` | zentrale Bootstrap-Typen/Defaults | Chunk, Input, Camera, Render, Inventory, Physics und FeatureFlags modellieren |
| `bootstrap/default_bootstrap.ts` | Fallback-Bootstrap | sicheren Remote-Chunk-Service-Bootstrap erzeugen |
| `bootstrap/read_bootstrap.ts` | Rohdaten lesen | Window-Globals, Dataset und Fallback lesen |
| `bootstrap/normalize_bootstrap.ts` | Normalisierung | alte Payloads auf `vectoplan-editor-bootstrap.v1` bringen, Legacy-Fallbacks deaktivieren |
| `config/runtime_config.ts` | Runtime-Adapter | Bootstrap zu Runtime-Config normalisieren; aktuell nicht Haupt-Wiring in aktiver SceneRuntime, aber weiterhin Konfigurationsschicht |

#### 4.3.4 DOM-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `dom/dom_refs.ts` | DOM-Hooks zentralisieren | Root, Canvas, Crosshair, Hotbar, LiveRegion, Loading/Error ansprechen |
| `dom/resize_observer.ts` | Viewport-/Canvas-Resize | Canvas-Größe, DPR, Aspect und Store-Sync aktualisieren |

#### 4.3.5 Input-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `input/input_state.ts` | zentraler Input-Snapshot | Keys, ActionKeys, Pointer, Wheel, Deltas und Reset verwalten |
| `input/keyboard_input.ts` | Keyboard-Adapter | WASD, Space, Shift, Q, Zahlen 1–9, Cancel/Inspect mappen |
| `input/mouse_input.ts` | Pointer-/Mouse-/Wheel-Adapter | Pointer Lock, LookDelta, Clicks, Wheel, ContextMenu erfassen |
| `input/pointer_lock.ts` | Pointer-Lock-Kapsel | request/exit, pointerlockchange/error, Retry, Store-Sync |
| `input/input_controller.ts` | Input-Orchestrator | MovementIntent, BlockIntent, Hotbar-Auswahl, Double-Space-One-Shot, Direct Pointer Fallback |
| `runtime/physics/double_tap_detector.ts` | Double-Tap-Erkennung | Space-Doppeltipp robust als Toggle-Event erkennen |

#### 4.3.6 Kamera-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `camera/camera_movement_math.ts` | Mathe für FPS-Kamera | Yaw/Pitch, Forward/Right/Up, MouseDelta, Legacy-Movement berechnen |
| `camera/camera_state.ts` | Kamera-State-Modell | Projection, Position, Rotation, Physics-Follow-Binding verwalten |
| `camera/first_person_camera_controller.ts` | Three-Camera-Controller | Look anwenden, direkte Bewegung optional, Physics-Binding auf Kamera schreiben |

#### 4.3.7 Inventory/Hotbar

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `inventory/inventory_models.ts` | Inventory-Typen | Items, Slots, Kataloge, Selection modellieren |
| `inventory/inventory_selection.ts` | Auswahlregeln | Slot-/Blockauswahl normalisieren |
| `inventory/inventory_slot_factory.ts` | Slot-Erzeugung | Backend-Blockdaten zu Hotbar-Slots machen, leere Slots auffüllen |
| `inventory/chunk_inventory_source.ts` | Inventory-Quelle | PlaceableBlocks laden, Fallbacks erzeugen, Catalog/Snapshot bereitstellen |
| `inventory/hotbar_controller.ts` | Hotbar-Orchestrierung | Slots rendern, Auswahl, Store-Sync, LiveMessages; Keyboard/Wheel aktuell zentral über InputController |

#### 4.3.8 World-/Chunk-Runtime

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `runtime/world/chunk_coordinates.ts` | Koordinatenlogik | World ↔ Chunk ↔ Local ↔ CellIndex, AABB/Range-Helfer, negative Koordinaten robust |
| `runtime/world/chunk_content.ts` | Chunk-Normalisierung | Cells/Palette/Stats/Solid-Infos erzeugen, Unknown Non-Air fail-closed solid behandeln |
| `runtime/world/chunk_registry.ts` | Client-Registry | Chunks, sichtbare/dirty/failed Keys, Cell-Sampling, Collision-Reader bereitstellen |
| `runtime/world/chunk_source.ts` | Source-Vertrag | Source Events, Capabilities, Dirty-Tracking, Stats definieren |
| `runtime/world/chunk_service_source.ts` | Remote-Source | ChunkApiClient anbinden, Chunks/Blocks/Commands/Dirty-Reload ausführen |
| `runtime/world/chunk_loader.ts` | Ladestrategie | Initial, AroundPosition, AroundChunk, Dirty-Reload laden |
| `runtime/world/world_runtime.ts` | World-Orchestrator | Source, Loader, Registry, Store und CollisionQuery zusammenführen |
| `runtime/world/chunk_edit_session.ts` | Edit-Session-Helfer | lokale/remote Edit-Kontexte und Dirty-Zusammenhänge vorbereiten |

#### 4.3.9 Physics-Runtime

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `runtime/physics/physics_models.ts` | Physics-Typen | Vectors, AABB, PlayerState, MovementIntent, CameraBinding, Snapshots definieren |
| `runtime/physics/physics_defaults.ts` | Defaults/Normalisierung | Movement, Gravity, Collider, MissingChunkPolicy, Debug Defaults erzeugen |
| `runtime/physics/physics_runtime.ts` | Frame-Orchestrator | Fixed/Frame-Step, PlayerController, Query, Snapshot, CameraBinding koordinieren |
| `runtime/physics/player_physics_controller.ts` | Player-Bewegung | Walking, Sprint, Jump/Fall, Flying, Double-Space Toggle, Gravity und Collision integrieren |
| `runtime/physics/block_collision_query.ts` | Collision-Abfrage | AABB gegen WorldCells abfragen, Missing/Unknown-Policies auswerten |
| `runtime/physics/voxel_collision_solver.ts` | Voxel-Solver | AABB-Bewegung entlang Achsen gegen solide Zellen lösen |
| `runtime/physics/double_tap_detector.ts` | Input-Event-Filter | Space-Doppeltipp als stabilen Toggle erkennen |

Aktuell bestätigte Physics-Fähigkeiten:

```text
- Player/Builder besitzt AABB-Collider.
- Bewegung geht nicht durch solide Blöcke.
- Collision-Daten kommen aus WorldRuntime/ChunkRegistry.
- Doppel-Leertaste aktiviert/deaktiviert Flugmodus.
- Beim Deaktivieren des Flugmodus fällt der Player wieder nach unten.
- Kamera folgt dem Physics-CameraBinding.
```

#### 4.3.10 Aktive SceneRuntime

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `scene/scene_runtime.ts` | aktive Browser-Runtime | Three.js Renderer, Scene, Camera, Chunks, UI, Input, Physics, Targeting und Commands verbinden |

Diese Datei ist aktuell der wichtigste Integrationspunkt. Sie enthält:

```text
- renderer / scene / camera
- chunksRoot und chunkMeshes
- inputController
- uiRuntime
- physicsRuntime
- Raycaster-Targeting
- renderFrame Loop über requestAnimationFrame
- updateCameraFromInput inklusive Physics-Step
- Place/Remove Command-Anbindung
- Chunk-Rendering aus Registry
- Runtime-Snapshot mit physics
```

#### 4.3.11 Runtime/Scene-Helfer unter `runtime/scene`

| Datei | Rolle | Status |
|---|---|---|
| `runtime/scene/scene_lifecycle.ts` | Lifecycle/Cleanup-Helfer | vorhanden, für modularere Runtime nutzbar |
| `runtime/scene/scene_loop.ts` | Loop-Abstraktion | vorhanden, aktuell nicht Hauptloop der aktiven SceneRuntime |
| `runtime/scene/scene_world_bridge.ts` | World↔Render-Bridge | vorhanden, alternative/modulare Scene-Architektur |
| `runtime/scene/scene_chunk_tools.ts` | Chunk-Command-Tools | vorhanden, in modularer Runtime nutzbar |
| `runtime/scene/scene_runtime.ts` | alternative SceneRuntime | aktuell nicht Browser-aktiv |

Hinweis:

```text
Diese Dateien sind nicht automatisch falsch, aber die aktuelle Browser-Signatur zeigt,
dass src/frontend/scene/scene_runtime.ts aktiv ist. Später kann entschieden werden,
ob runtime/scene/* konsolidiert, gelöscht oder als neue modulare Architektur reaktiviert wird.
```

#### 4.3.12 Render-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `render/three_context.ts` | Renderer-Kontext | alternative/modulare Three-Abstraktion mit Renderer/Scene/Camera |
| `render/chunk_mesher.ts` | Meshing | RuntimeChunks zu Meshdaten/Instanzen machen |
| `render/chunk_scene.ts` | Chunk-Scene-Verwaltung | Chunk-Meshes an Three-Gruppen hängen |
| `render/preview_renderer.ts` | Vorschau/Highlight | Placement Preview und Target Highlight rendern |
| `render/debug_overlay.ts` | Render-Debug | Debug-Informationen anzeigen |

Aktive `scene/scene_runtime.ts` rendert derzeit eigene InstancedMeshes direkt. Die Render-Module bleiben relevant für die modulare Zielarchitektur und Teile der bestehenden UI/Debug-Struktur.

#### 4.3.13 Targeting

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `targeting/chunk_targeting.ts` | Chunk-/Block-Raytargeting | Zielzellen, Placement-Zellen, Status und Store-Sync berechnen |

In der aktiven `scene/scene_runtime.ts` wird aktuell zusätzlich ein eigener Three.js-Raycaster auf die InstancedMeshes genutzt, um Zielblöcke im Crosshair zu bestimmen.

#### 4.3.14 State-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `state/editor_state.ts` | Gesamtzustand | Bootstrap, Lifecycle, Project, Viewport, Input, Camera, World, Inventory, Targeting, Command, Render, UI, Debug halten |
| `state/player_state.ts` | Player-Zustand | Physics-Player-State, MovementMode, Grounded/Flying, Position, Velocity, CollisionFlags halten |
| `state/state_actions.ts` | Reducer/Actions | Camera/Input/World/Inventory/Targeting/Command/Render/UI/Player aktualisieren |
| `state/editor_store.ts` | Store | get/peek/set/patch/subscribe, History/Notify steuern |
| `state/state_selectors.ts` | Selector-API | UI, Runtime, Inventory, Targeting, Player, Debug, World und Status ableiten |

Aktuell wichtig:

```text
player/update wird von der aktiven SceneRuntime nach jedem Physics-Step geschrieben.
physicsRevision steigt bei laufender Physics.
state.player.flying / movementMode spiegeln Doppel-Leertaste-Flugmodus.
```

#### 4.3.15 UI-Schicht

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `ui/editor_ui_runtime.ts` | UI-Orchestrator | Statusbar, Hotbar, Loading, Error, LiveRegions aktualisieren |
| `ui/status_bar.ts` | Statusbar | Runtime-/World-/Player-/Command-Status anzeigen |
| `ui/hotbar_view.ts` | Hotbar-DOM | Slots rendern, Selection anzeigen |
| `ui/crosshair_view.ts` | Crosshair | Ziel-/Place-/Remove-/Blocked-Zustand visualisieren |
| `ui/loading_overlay.ts` | Loading | Start-/Verbindungszustand anzeigen |
| `ui/error_panel.ts` | Fehlerpanel | Fatal/Runtime-Fehler anzeigen |
| `ui/debug_overlay.ts` | Debug UI | optionale Debugdaten anzeigen |

#### 4.3.16 Utils

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `utils/safe.ts` | sichere Normalisierung | unknown → string/number/boolean/array/record, Error-Normalisierung |
| `utils/logger.ts` | Logger | child logger, debug/info/warn/error |
| `utils/ids.ts` | IDs/Keys | Editor-IDs, ChunkKeys, Parse/Normalize |
| `utils/time.ts` | Zeit | ISO-Zeitstempel und Time-Helfer |

### 4.4 Backend-/Template-Dateien im Service

| Datei | Rolle | Kann aktuell |
|---|---|---|
| `routes/editor.py` | Editor-Seite | Bootstrap-Payload + Template + Manifest-Assets für `/editor` ausliefern |
| `routes/chunk.py` | Chunk-Proxy | Browser `/editor/api/chunk` zu vectoplan-chunk weiterleiten |
| `src/clients/chunk_client.py` | Server-HTTP-Client | serverseitig `http://vectoplan-chunk:5000` ansprechen |
| `templates/editor/index.html` | produktive HTML-Seite | Fullscreen Root, Canvas, Crosshair, Hotbar, Loading/Error Hooks |
| `templates/editor/partials/head.html` | Head/Assets | CSS/JS/Meta/Preload aus Manifest einbinden |
| `templates/editor/partials/bootstrap_scripts.html` | Bootstrap Globals | Window-Globals und Dataset für Frontend schreiben |
| `static/editor/manifest.json` | Build-Manifest | Vite Entry und hashed Assets referenzieren |
| `static/editor/assets/*` | Build-Artefakte | gebaute JS/CSS/Chunks ausliefern |

### 4.5 Aktive vs. aufzuräumende Struktur

Aktiv und produktiv:

```text
services/vectoplan-editor/src/frontend/main.ts
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
services/vectoplan-editor/src/frontend/runtime/world/*
services/vectoplan-editor/src/frontend/runtime/physics/*
services/vectoplan-editor/src/frontend/input/*
services/vectoplan-editor/src/frontend/state/*
services/vectoplan-editor/src/frontend/ui/*
services/vectoplan-editor/src/frontend/api/*
```

Vorhanden, aber nicht aktuell als Browser-SceneRuntime bestätigt:

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
services/vectoplan-editor/src/frontend/runtime/scene/scene_loop.ts
services/vectoplan-editor/src/frontend/runtime/scene/scene_lifecycle.ts
services/vectoplan-editor/src/frontend/runtime/scene/scene_world_bridge.ts
services/vectoplan-editor/src/frontend/runtime/scene/scene_chunk_tools.ts
```

Aufräumkandidat nach Absicherung:

```text
services/vectoplan-editor/frontend
```

Prüfen vor Löschung:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend|vectoplan-editor/frontend" .
```

### 4.6 Capability-Zusammenfassung nach Datei-Clustern

```text
api/*
→ Kann Remote-Chunk-Service sicher ansprechen, normalisieren und Fehler typisiert liefern.

bootstrap/* + config/*
→ Kann alte/neue Bootstrap-Quellen auf eine stabile EditorBootstrap-/RuntimeConfig-Struktur bringen.

dom/*
→ Kann alle produktiven DOM-Hooks finden und UI/Canvas/LiveRegion robust ansprechen.

input/*
→ Kann Keyboard, Mouse, PointerLock, Wheel, Hotbar-Auswahl, Place/Remove und Double-Space-Flight-Toggle erfassen.

camera/*
→ Kann First-Person-Look und Physics-Camera-Follow stabil auf Three.js Camera anwenden.

runtime/world/*
→ Kann Chunks laden, speichern, samplen, dirty tracken, Collision-Zellen liefern und Commands ausführen.

runtime/physics/*
→ Kann Player-AABB, Gravity, Walking, Sprinting, Flying, Collision und Flight-Toggle simulieren.

scene/scene_runtime.ts
→ Kann alle Systeme in der aktiven Browser-Runtime verbinden und pro Frame updaten.

state/*
→ Kann kompletten Editorzustand inklusive PlayerPhysics, Camera, Inventory, Targeting, UI und Debug halten.

ui/*
→ Kann Hotbar, Status, Error, Loading, Crosshair und Debug-Overlay aus Store/Runtime darstellen.
```

---

## 5. Build-/Docker-/Runtime-Status

### 5.1 Dockerfile

Der Dockerfile nutzt den neuen Frontend-Build.

Aktueller Build-Pfad:

```text
services/vectoplan-editor/src/frontend
```

Aktuelles Build-Ziel:

```text
services/vectoplan-editor/static/editor
```

Pflicht-Artefakt:

```text
services/vectoplan-editor/static/editor/manifest.json
```

Nicht mehr Pflicht:

```text
services/vectoplan-editor/static/editor/js/main.js
services/vectoplan-editor/static/editor/css/editor.css
```

Wichtig:

```text
Vite erzeugt hashed Assets unter static/editor/assets/.
Das Backend darf deshalb keine festen JS-/CSS-Dateinamen erwarten.
```

### 5.2 Vite/TypeScript

Akzeptanz:

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

Erwartung:

```text
typecheck erfolgreich
static/editor/manifest.json vorhanden
static/editor/assets/*.js vorhanden
```

---

## 6. Backend-Auslieferung

### 6.1 Editor-Route

Die Editor-Route liefert `/editor` aus.

Aktueller Browser-Stand:

```text
http://localhost:5000/editor
→ lädt erfolgreich
→ Canvas sichtbar
→ Chunk-Service verbunden
→ Welt gerendert
→ Crosshair sichtbar
→ Hotbar sichtbar
→ Pointer Lock aktivierbar
→ Blöcke können gesetzt/entfernt werden
→ Physics/Collision aktiv
→ Flugmodus per Doppel-Leertaste aktivierbar/deaktivierbar
```

Relevante Datei:

```text
services/vectoplan-editor/routes/editor.py
```

Aufgaben dieser Route:

```text
Bootstrap-Payload erzeugen
Editor-Template rendern
Vite-Assets aus static/editor/manifest.json an Jinja übergeben
Chunk-Service-Route-Hints in Window-Globals und Dataset schreiben
Physics-/Camera-/Input-/Feature-Flags in Bootstrap/Dataset durchreichen
```

### 6.2 Template `templates/editor/index.html`

Das Template stellt Fullscreen-Editor, Crosshair, Hotbar und Bootstrap-Dataset bereit.

Wichtige DOM-Hooks:

```text
data-editor-root
data-editor-canvas-host
data-editor-crosshair
data-editor-hotbar
data-editor-hotbar-slots
data-editor-live-region
data-pointer-lock-enabled
data-crosshair-enabled
data-hotbar-enabled
data-inventory-hotbar-size
data-inventory-default-block-type-id
data-camera-look-sensitivity
data-physics-enabled
data-player-collision-enabled
data-flight-mode-enabled
data-camera-physics-follow-enabled
data-camera-direct-movement-enabled
```

Wichtig:

```text
Diese Datei ist die produktive Flask-/Jinja-Seite für /editor.
src/frontend/index.html ist nur für Vite-/Dev-Kontext relevant.
```

---

## 7. API-Schicht im Frontend

### 7.1 Backend-Block-Vertrag

Die Blocklisten sind klar getrennt:

```text
placeableBlocks
→ aktive Inventory-/Hotbar-Liste
→ aktuell für auswählbare Slots genutzt
→ kurzfristige Quelle für debug_grass/debug_dirt

blocks
→ vollständiger Blockkatalog
→ später Creative Library / Block-Browser
→ nicht direkt als aktive Hotbar-Wahrheit verwenden
```

### 7.2 `api/chunk_api_client.ts`

Browser-Client für:

```text
/editor/api/chunk
```

Kann:

```text
loadStatus()
testConnection()
loadProjectBootstrap()
loadPlaceableBlocks()
loadBlocks()
loadChunk()
loadChunksBatch()
sendCommand()
sendSetBlock()
sendRemoveBlock()
```

Wichtig:

```text
Der Browser spricht nicht direkt mit http://vectoplan-chunk:5000.
Der Browser spricht nur mit /editor/api/chunk.
```

---

## 8. Bootstrap- und Runtime-Config-Schicht

### 8.1 `bootstrap/bootstrap_models.ts`

Zentrale Bootstrap-Modelle und Defaults für:

```text
runtime.chunk
runtime.physics
Kamera
Render
Input
Inventory
Creative Library
FeatureFlags
UI Flags
```

Aktuelle Flags/Defaults:

```text
pointerLockEnabled = true
firstPersonEnabled = true
physicsEnabled = true
playerCollisionEnabled = true
flightModeEnabled = true
crosshairEnabled = true
hotbarEnabled = true
creativeLibraryEnabled = true
camera.physicsFollowEnabled = true
camera.directMovementEnabled = false
inventory.inventoryRouteKind = placeable-blocks
inventory.creativeLibraryRouteKind = blocks
```

### 8.2 `config/runtime_config.ts`

Diese Datei existiert als Adapter-Schicht für normalisierte Runtime-Werte. In der aktuell aktiven Browser-SceneRuntime wurde die Physics-Konfiguration zusätzlich lokal aus `bootstrap.runtime.physics` aufgebaut, weil die aktive Runtime-Datei unter `src/frontend/scene/scene_runtime.ts` liegt und nicht die zuvor bearbeitete Datei unter `src/frontend/runtime/scene/scene_runtime.ts` war.

Aktueller Befund:

```text
Runtime-Config im globalen Runtime-Handle kann eine andere Shape haben als unsere Adapter-Typen.
Die aktive SceneRuntime liest für Physics zuverlässig aus bootstrap.runtime.physics / bootstrap.physics.
```

Wichtig:

```text
Langfristig sollte config/runtime_config.ts mit dem tatsächlich global sichtbaren RuntimeConfig-Shape konsolidiert werden.
Kurzfristig funktioniert die aktive SceneRuntime robust über bootstrap.runtime.physics.
```

---

## 9. World-Runtime- und Collision-Schicht

### 9.1 `runtime/world/chunk_content.ts`

Normalisiert `ChunkApiRuntimeChunkContent` zu `RuntimeChunkContent`.

Aktuelle Collision-relevante Regeln:

```text
cellValue = 0 → Air
cellValue > 0 → Block
paletteByCellValue und paletteByBlockTypeId werden aufgebaut
solid wird aus Palette gelesen
unbekannte Non-Air-Zellen werden fail-closed als solid behandelt
```

### 9.2 `runtime/world/chunk_registry.ts`

Clientseitige Registry für:

```text
geladene Chunks
sichtbare Chunks
dirty Chunks
failed Chunks
RuntimeChunkContent
Collision-Zellen
BlockCollisionWorldReader
```

Wichtige Methoden:

```text
sampleCellByWorldPosition(position)
getCollisionCell({ x, y, z })
isCellLoaded({ x, y, z })
createBlockCollisionWorldReader(sourceName)
```

Bestätigte Browser-Probe:

```text
worldRuntime.getCollisionCell({ x: 8, y: 7, z: 18 })
→ loaded: true
→ solid: true
→ kind: solid
→ blockTypeId: debug_grass
```

### 9.3 `runtime/world/world_runtime.ts`

Orchestriert:

```text
ChunkServiceSource
ChunkLoader
ChunkRegistry
Store-Updates
CollisionWorldReader
BlockCollisionQuery
```

Wichtige Collision-Schnittstellen:

```text
getCollisionWorldReader()
getBlockCollisionQuery()
getCollisionCell(cell)
isCollisionCellLoaded(cell)
getCollisionSnapshot()
```

---

## 10. Physics-Schicht

Neue lokale Physics-Schicht:

```text
src/frontend/runtime/physics/physics_models.ts
src/frontend/runtime/physics/physics_defaults.ts
src/frontend/runtime/physics/physics_runtime.ts
src/frontend/runtime/physics/player_physics_controller.ts
src/frontend/runtime/physics/block_collision_query.ts
src/frontend/runtime/physics/voxel_collision_solver.ts
src/frontend/runtime/physics/double_tap_detector.ts
```

### 10.1 Rolle

```text
physics_models.ts
→ zentrale Typen für Vektoren, AABB, PlayerState, MovementIntent, CameraBinding

physics_defaults.ts
→ robuste Defaults für Timing, Movement, Collider, Missing-Chunk-Policy

physics_runtime.ts
→ Frame-Integrator und Orchestrator zwischen Input, PlayerController und CollisionQuery

player_physics_controller.ts
→ Movement, Gravity, Jump/Fly, Grounding, Flying, Damping

block_collision_query.ts
→ Query gegen WorldRuntime/ChunkRegistry, fehlende Chunks fail-closed

voxel_collision_solver.ts
→ AABB-vs-Block-Auflösung pro Achse

double_tap_detector.ts
→ Space-Double-Tap-Erkennung für Flugmodus
```

### 10.2 Aktueller bestätigter Funktionsstand

```text
- Spieler/Builder besitzt Collider
- Bewegung läuft bei aktivem Physics nicht mehr direkt über Kamera-Position
- Bewegung wird gegen BlockCollisionQuery aufgelöst
- Spieler kann nicht mehr durch solide Blöcke
- Flugmodus kann per Doppel-Leertaste aktiviert werden
- Flugmodus kann per erneuter Doppel-Leertaste deaktiviert werden
- nach Flugmodus-Aus fällt der Spieler durch Gravity zurück auf den Boden
```

### 10.3 Config-Werte

Aktuelle Defaults/Bootstrap-Werte:

```text
fixedTimeStepSeconds = 1 / 60
maxFrameDeltaSeconds = 0.25
maxSubSteps = 8
walkSpeed ≈ 4.25
sprintSpeed ≈ 5.65
airControlSpeed ≈ 2.35
flySpeed ≈ 6.5
flySprintSpeed ≈ 10.5
jumpVelocity ≈ 6.25
gravity ≈ -18
maxFallSpeed ≈ -32
groundSnapDistance ≈ 0.08
playerWidth ≈ 0.6
playerHeight ≈ 1.8
eyeHeight ≈ 1.62
missingChunkPolicy = block
```

---

## 11. Aktive Scene-/Render-Schicht

### 11.1 Aktive Datei

Produktiv aktiv:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Nicht produktiv aktiv für den Browser-Stand:

```text
services/vectoplan-editor/src/frontend/runtime/scene/scene_runtime.ts
```

### 11.2 Aufgaben der aktiven SceneRuntime

Die aktive SceneRuntime besitzt aktuell eine direkte Three.js-Implementierung:

```text
THREE.WebGLRenderer
THREE.Scene
THREE.PerspectiveCamera
THREE.Group für Chunks
THREE.InstancedMesh für Blöcke
Raycaster für Crosshair-/Block-Targeting
ResizeObserver
InputController
EditorUiRuntime
PhysicsRuntime
```

### 11.3 Aktueller Frame-Loop

Aktueller Zielablauf pro Frame:

```text
requestAnimationFrame(renderFrame)
→ InputSnapshot lesen
→ Mouse lookDelta auf Kamera-Yaw/Pitch anwenden
→ MovementIntent vom InputController lesen
→ bei Physics aktiv:
   physicsRuntime.stepFrame({
     nowMs,
     deltaSeconds,
     movementIntent: movementIntent.physics,
     lookAngles,
     query: worldRuntime.getBlockCollisionQuery()
   })
→ Player-State in Store schreiben
→ Kamera an physicsFrame.camera binden
→ Input-Deltas resetten
→ Targeting aktualisieren
→ Chunks um Kamera/Player nachladen
→ Renderer rendert Scene
```

### 11.4 Warum die letzte Reparatur nötig war

Während der Diagnose wurde festgestellt:

```text
- Input Double-Space wurde korrekt erkannt.
- Collision-Reader erkannte solide Blöcke korrekt.
- Bootstrap hatte physicsEnabled/playerCollisionEnabled/flightModeEnabled aktiv.
- Store-Player physicsRevision blieb 0.
- Scene-Snapshot hatte hasPhysicsSnapshot = false.
```

Ursache:

```text
Die falsche SceneRuntime-Datei wurde bearbeitet.
Die aktive Browser-Runtime war src/frontend/scene/scene_runtime.ts.
```

Behebung:

```text
PhysicsRuntime wurde in die aktive src/frontend/scene/scene_runtime.ts integriert.
```

---

## 12. Input- und Kamera-Schicht

### 12.1 Aktueller Bedienstand

Bestätigt:

```text
Maus:
- Klick in Viewport aktiviert Pointer Lock
- Mausbewegung dreht Kamera ohne gedrückte Taste
- Mitte/Crosshair bleibt zentral
- Linksklick setzt Blöcke
- Rechtsklick entfernt Blöcke

Tastatur:
- W = vorwärts
- S = rückwärts
- A = links
- D = rechts
- Shift = Sprint
- Space = Jump/Fly-Up
- Q = Fly-Down
- Doppel-Space = Flugmodus toggeln
- Zahlen 1–9 wählen Hotbar-Slots

Hotbar:
- Slots sichtbar
- Slot 1 = Debug Grass
- Slot 2 = Debug Dirt
- leere Slots sichtbar
- Mausrad rotiert auswählbare Slots
```

### 12.2 `input/input_controller.ts`

Zentrale Input-Orchestrierung.

Aktuelle wichtige Korrekturen:

```text
1. Harte Place/Remove-Vorprüfungen wurden aus dem InputController entfernt.
   Scene/Targeting validieren final.

2. Direkter Pointer-Fallback auf Canvas/CanvasHost wurde ergänzt.
   Dadurch kommen Linksklick/Rechtsklick zuverlässig bei executePlace/executeRemove an.

3. Pointer-Actions werden dedupliziert.
   Dadurch feuert pointerdown/mousedown/click nicht mehrfach denselben Command.

4. W/S wurden im MovementIntent gedreht.
   A/D bleiben unverändert.

5. Space-Double-Tap erzeugt toggleFlightRequested als One-Shot.
   Der Toggle wird nicht dauerhaft gehalten, sondern einmalig von getMovementIntent() konsumiert.
```

Aktuelle Movement-Achse:

```text
forward = movementAxis(snapshot, "move-backward", "move-forward")
right   = movementAxis(snapshot, "move-right", "move-left")
up      = ascendHeld - descendHeld
```

Damit gilt:

```text
W → forward negativ → vorwärts in aktueller Runtime-Konvention
S → forward positiv → rückwärts
A/D unverändert korrekt
```

### 12.3 `input/input_state.ts`

Verantwortlich für:

```text
KeyboardSnapshot
PointerSnapshot
WheelSnapshot
pressedKeys
pressedActionKeys
pointerLocked
lookDelta
accumulatedLookDelta
wheelDelta
resetDeltas
```

Space-Events wurden in der Browser-Console bestätigt:

```text
keydown Space repeat:false
keyup Space
keydown Space repeat:false
keyup Space
```

---

## 13. Inventory-/Hotbar-Schicht

Aktuelle Wahrheit:

```text
placeableBlocks = aktive Inventory-/Hotbar-Liste
blocks = vollständiger Katalog für spätere Creative Library
```

Aktueller Stand:

```text
- Hotbar lädt erfolgreich
- Slot 1/2 sind mit debug_grass/debug_dirt belegt
- Auswahl funktioniert
- Mausrad-Navigation funktioniert
- Store selectedItem/blockTypeId ist korrekt
```

Kurzfristig erlaubte Blocktypen:

```text
debug_grass
debug_dirt
```

Nicht mehr als aktive Remote-Place-IDs verwenden, solange der Chunk-Service sie nicht kennt:

```text
grass
dirt
stone
wood
planks
glass
light
metal
marker
```

---

## 14. State-Schicht

Wichtige Dateien:

```text
state/editor_state.ts
state/player_state.ts
state/state_actions.ts
state/editor_store.ts
state/state_selectors.ts
```

Aktuelle Korrekturen:

```text
- Pointer Lock State wird über input/pointer-lock gespiegelt
- Inventory/Catalog wird aus Hotbar/InventorySource in Store geschrieben
- Targeting wird aus Camera Position/Forward im SceneLoop aktualisiert
- Crosshair-Varianten leiten sich aus Targeting und CanPlace/CanRemove ab
- Player-State wird über player/update aus PhysicsRuntime synchronisiert
- Player-Selectors liefern movementMode, grounded, flying, velocity, collisionFlags
```

Relevante Store-Felder:

```text
state.player.position
state.player.velocity
state.player.eyePosition
state.player.angles
state.player.movementMode
state.player.grounded
state.player.flying
state.player.collisionFlags
state.player.physicsRevision
state.player.lastFlightToggleAtMs
```

---

## 15. Aktueller Place-/Break-Zielpfad

### Place

```text
User Linksklick
→ input_controller.ts direkter Pointer-Fallback / mouse_input.ts
→ executePlace()
→ aktive scene_runtime.ts onPlaceBlock
→ worldRuntime.getSource().setBlock(position, blockTypeId)
→ chunk_service_source.ts
→ chunk_api_client.ts sendSetBlock()
→ POST /editor/api/chunk/projects/dev-project/worlds/world_spawn/commands
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
→ ChunkSnapshot / ChunkEvent / WorldCommandLog
→ dirtyChunks
→ reloadDirtyChunks()
→ remesh/render
→ Block sichtbar
```

### Remove

```text
User Rechtsklick
→ input_controller.ts direkter Pointer-Fallback / mouse_input.ts
→ executeRemove()
→ aktive scene_runtime.ts onRemoveBlock
→ worldRuntime.getSource().removeBlock(position)
→ chunk_service_source.ts
→ chunk_api_client.ts sendRemoveBlock()
→ POST /editor/api/chunk/projects/dev-project/worlds/world_spawn/commands
→ routes/chunk.py
→ src/clients/chunk_client.py
→ vectoplan-chunk
→ ChunkSnapshot / ChunkEvent / WorldCommandLog
→ dirtyChunks
→ reloadDirtyChunks()
→ remesh/render
→ Block entfernt sichtbar
```

Bestätigt:

```text
Browser-End-to-End Place funktioniert.
Browser-End-to-End Remove funktioniert.
Inventory/Hotbar funktioniert.
```

Noch separat absichern:

```text
Browser Reload zeigt bestätigten Zustand nach SetBlock/RemoveBlock.
```

---

## 16. Diagnose-Ergebnisse aus der letzten Reparaturrunde

### 16.1 Input war nicht die Ursache

Bestätigt:

```text
Space keydown/keyup kommt im Browser an.
repeat:false.
inputLastFlightToggleAt wird gesetzt.
```

Folgerung:

```text
Double-Space-Erkennung funktioniert.
```

### 16.2 Collision war nicht die Ursache

Bestätigt:

```text
worldRuntime.getCollisionCell({ x: 8, y: 7, z: 18 })
→ loaded: true
→ solid: true
→ kind: solid
→ blockTypeId: debug_grass
```

Folgerung:

```text
ChunkRegistry/WorldRuntime liefern solide Collision-Daten.
```

### 16.3 Warum Physics zunächst nicht aktiv war

Beobachtung:

```text
sceneSnapshot.physics = undefined
state.player.physicsRevision = 0
```

Ursache:

```text
Falsche SceneRuntime-Datei wurde bearbeitet:
src/frontend/runtime/scene/scene_runtime.ts

Aktiv war aber:
src/frontend/scene/scene_runtime.ts
```

Behebung:

```text
PhysicsRuntime wurde in die aktive SceneRuntime integriert.
```

---

## 17. Alte Dateien und Ordner

### 17.1 Sofortiger Aufräumkandidat

```text
services/vectoplan-editor/frontend
```

Begründung:

```text
Ersetzt durch services/vectoplan-editor/src/frontend.
```

Vorher/Nachher prüfen:

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" .
```

### 17.2 SceneRuntime-Konsolidierung

Aktuell prüfen:

```bash
rg -n "createSceneRuntime|renderOnce|getUiRuntime|getThreeContext|getWorldBridge" services/vectoplan-editor/src/frontend
```

Ziel:

```text
Nur eine produktive SceneRuntime behalten oder eindeutig dokumentieren.
Aktive Datei: src/frontend/scene/scene_runtime.ts
```

### 17.3 Nur löschen, wenn keine Imports mehr existieren

```text
services/vectoplan-editor/clients/chunk_client.py
```

Ersetzt durch:

```text
services/vectoplan-editor/src/clients/chunk_client.py
```

Prüfung:

```bash
rg -n "from clients.chunk_client|import clients.chunk_client|clients/chunk_client" services/vectoplan-editor
```

---

## 18. Diagnosebefehle

### 18.1 Typecheck/Build

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

### 18.2 Docker

```bash
docker compose up -d --build vectoplan-editor
docker compose logs -f vectoplan-editor
```

### 18.3 Manifest

```bash
ls -la services/vectoplan-editor/static/editor
cat services/vectoplan-editor/static/editor/manifest.json
```

### 18.4 Aktive SceneRuntime finden

PowerShell:

```powershell
Get-ChildItem ".\services\vectoplan-editor\src\frontend" -Recurse -Include *.ts,*.tsx |
  Select-String "renderOnce|getUiRuntime" |
  Format-List Path,LineNumber,Line
```

Erwartung aktuell:

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

### 18.5 Browser-Konsole – Runtime/Store

```js
const rt = window.vectoplanEditorRuntime || window.editorRuntime || window.__VECTOPLAN_RUNTIME__;
rt.getBootstrap();
rt.getRuntimeConfig();
rt.getState();
rt.getSceneRuntime().getSnapshot();
rt.getWorldRuntime().getCollisionCell({ x: 8, y: 7, z: 18 });
```

### 18.6 Browser-Konsole – Physics/Player

```js
(() => {
  const rt = window.vectoplanEditorRuntime || window.editorRuntime || window.__VECTOPLAN_RUNTIME__;
  const state = rt?.getState?.();
  const scene = rt?.getSceneRuntime?.();
  console.table({
    storeMovementMode: state?.player?.movementMode,
    storeFlying: state?.player?.flying,
    storeGrounded: state?.player?.grounded,
    storePhysicsRevision: state?.player?.physicsRevision,
    sceneHasPhysics: !!scene?.getSnapshot?.()?.physics,
    sceneFlying: scene?.getSnapshot?.()?.physics?.player?.flying,
    sceneGrounded: scene?.getSnapshot?.()?.physics?.player?.grounded,
  });
})();
```

### 18.7 Browser-Konsole – Collision

```js
(() => {
  const rt = window.vectoplanEditorRuntime || window.editorRuntime || window.__VECTOPLAN_RUNTIME__;
  const world = rt?.getWorldRuntime?.();
  console.log(world?.getCollisionCell?.({ x: 8, y: 7, z: 18 }));
})();
```

---

## 19. Akzeptanzkriterien

Bereits erreicht:

```text
1. src/frontend ist produktive Frontend-Quelle.
2. TypeScript-Typecheck läuft nach Korrekturen durch.
3. Vite-Build erzeugt static/editor/manifest.json.
4. Docker-Build läuft durch.
5. Runtime-Entrypoint prüft Manifest statt static/editor/js/main.js.
6. /editor lädt im Browser.
7. Fullscreen-Canvas füllt den Browser-Viewport.
8. Chunk-Service wird als verbunden angezeigt.
9. initiale Chunk-Fläche wird gerendert.
10. sichtbare Blöcke erscheinen im Viewport.
11. Crosshair ist mittig sichtbar.
12. Pointer Lock funktioniert.
13. Maus-Look funktioniert ohne gedrückte Maustaste.
14. Hotbar ist sichtbar.
15. Hotbar lädt aktive Inventory-Liste aus Backend/Chunk-Service.
16. Mausrad-Auswahl funktioniert.
17. Linksklick setzt Blöcke.
18. Rechtsklick entfernt Blöcke.
19. W/A/S/D ist korrekt:
    - W vorwärts
    - S rückwärts
    - A links
    - D rechts
20. Player-Physics ist aktiv.
21. Spieler kann nicht mehr durch Blöcke fliegen/laufen.
22. Doppel-Leertaste aktiviert Flugmodus.
23. erneute Doppel-Leertaste deaktiviert Flugmodus.
24. Spieler fällt nach Flugmodus-Aus durch Gravity zurück.
25. WorldRuntime liefert solide Collision-Zellen korrekt.
```

Noch offen:

```text
1. services/vectoplan-editor/frontend löschen.
2. Keine produktiven Pfade zeigen mehr auf services/vectoplan-editor/frontend.
3. Aktive und inaktive SceneRuntime-Dateien konsolidieren oder eindeutig aufräumen.
4. /editor/api/chunk/_status dauerhaft als Smoke-Test absichern.
5. /editor/api/chunk/_test/connection dauerhaft als Smoke-Test absichern.
6. Browser Reload zeigt bestätigten SetBlock/RemoveBlock-Zustand.
7. Automatisierte E2E-Tests für Place/Remove ergänzen.
8. Automatisierte E2E-/Manual-Testliste für Pointer Lock ergänzen.
9. Automatisierte E2E-/Manual-Testliste für Physics/Collision/Flight ergänzen.
10. Creative-Library-UI an blocks-Katalog anschließen.
11. Direkten Pointer-Fallback später optional in mouse_input.ts konsolidieren.
12. Alte lokale BlockWorld-Reste entfernen, sobald Persistenz/E2E abgesichert ist.
```

---

## 20. Konkrete nächste Schritte

### Schritt 1 – aktive SceneRuntime absichern

```text
services/vectoplan-editor/src/frontend/scene/scene_runtime.ts
```

Prüfen:

```text
- physicsRuntime wird erzeugt, wenn runtime.physics.enabled && featureFlags.physicsEnabled && featureFlags.playerCollisionEnabled.
- updateCameraFromInput nutzt bei Physics aktiv nicht mehr direkte Kamera-Bewegung.
- physicsRuntime.stepFrame erhält worldRuntime.getBlockCollisionQuery().
- Kamera folgt physicsFrame.camera.
- Store bekommt player/update.
```

### Schritt 2 – Typecheck/Build ausführen

```bash
cd services/vectoplan-editor/src/frontend
npm run typecheck
npm run build
```

Danach:

```bash
docker compose up -d --build vectoplan-editor
```

### Schritt 3 – Browser-Matrix manuell testen

```text
1. /editor öffnen
2. W läuft vorwärts
3. S läuft rückwärts
4. A läuft links
5. D läuft rechts
6. Klick in Viewport aktiviert Pointer Lock
7. Maus bewegt Kamera ohne gedrückte Taste
8. ESC löst Pointer Lock
9. erneuter Klick aktiviert Pointer Lock wieder
10. Mausrad wechselt Hotbar Slot
11. Linksklick setzt Block
12. Rechtsklick entfernt Block
13. gegen Block laufen/fliegen → blockiert
14. Doppel-Leertaste → Flugmodus an
15. nochmal Doppel-Leertaste → Flugmodus aus
16. nach Flugmodus-Aus fällt Spieler auf Boden
17. Reload prüfen
```

### Schritt 4 – Legacy-Frontend entfernen

```bash
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" .
rm -rf services/vectoplan-editor/frontend
rg -n "services/vectoplan-editor/frontend|frontend/src|/frontend/src|cd services/vectoplan-editor/frontend" .
```

### Schritt 5 – SceneRuntime-Duplikat prüfen

```bash
rg -n "createSceneRuntime|renderOnce|getUiRuntime|requestRender|getThreeContext" services/vectoplan-editor/src/frontend
```

Entscheidung:

```text
- entweder alte runtime/scene/scene_runtime.ts entfernen,
- oder klar dokumentieren, dass src/frontend/scene/scene_runtime.ts produktiv aktiv ist.
```

### Schritt 6 – Proxy direkt testen

```bash
curl -sS http://127.0.0.1:5000/editor/api/chunk/_status
curl -sS http://127.0.0.1:5000/editor/api/chunk/_test/connection
curl -sS http://127.0.0.1:5000/editor/api/chunk/placeable-blocks
```

---

## 21. Aktueller Gesamtbefund

Der aktuelle Gesamtbefund lautet:

```text
Der VECTOPLAN Editor ist erfolgreich auf die neue src/frontend-basierte
Remote-Chunk-Service-Runtime umgestellt.

Der Build läuft, das Vite-Manifest wird erzeugt, der Container startet,
die Flask-/Jinja-Seite liefert die gebauten Assets aus, und der Browser zeigt
einen funktionierenden Fullscreen-Viewport mit gerenderter Chunk-Welt.

Zusätzlich ist die Interaktion jetzt funktional:
- Crosshair vorhanden
- Hotbar/Inventory vorhanden
- Mausrad-Slotwechsel funktioniert
- Pointer Lock funktioniert
- freie Maus-Kamera wie Minecraft/Hytale funktioniert
- W/A/S/D-Steuerung ist korrekt
- Linksklick setzt Blöcke
- Rechtsklick entfernt Blöcke
- Player-Physics läuft gegen Chunk-Collision
- Spieler kann nicht mehr durch Blöcke fliegen/laufen
- Doppel-Leertaste toggelt Flugmodus
- Flugmodus-Aus lässt den Spieler wieder fallen

Die wichtigste verbleibende Arbeit ist nicht mehr Build-/Startfähigkeit
oder Basisspielbarkeit, sondern Stabilisierung, Persistenznachweis,
SceneRuntime-Konsolidierung, Legacy-Aufräumung und Ausbau der Creative Library.
```

Kurzform:

```text
Build, Browser-Start, Fullscreen-Viewport, Kamera, Hotbar, Inventory,
Place, Remove, Physics-Collision und Flight-Toggle sind erreicht.

Nächster Fokus:
- aktive/inaktive SceneRuntime konsolidieren
- Reload-Persistenz prüfen
- Legacy-Aufräumung
- Creative Library anschließen
- E2E-/Smoke-Tests ergänzen
```

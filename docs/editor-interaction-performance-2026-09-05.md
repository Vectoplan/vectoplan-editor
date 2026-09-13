# Editor interaction and rendering follow-up, 2026-09-05

## Result

Equipping Linebrush only activates the tool. The building gear opens its compact, nonmodal settings panel. The commit action is **Bestätigen**; the redundant default-template summary and new-building button are removed. Camera control and scene point insertion, deletion and dragging remain available while the panel is open. Draft edits stay local until confirmation instead of rebuilding persisted geometry for every input. The settings panel has no internal scrollbar. Closing Storey settings clears the selected building and its adjustment handles.

Linebrush buildings and roofs have a delete action beside their settings gear. Whole-building removal resolves all generated children on the server and checks the current generation and ownership atomically. Removing an imported roof retains its facade data as a non-rendered `building_facade_source`. A persisted removed-roof marker prevents immutable dataset reloads from restoring the roof. Subsequent storey/contour edits retain that distinction; whole-building deletion removes the retained source too.

LoD2 discovery reads the loaded object registry independently of whether a roof mesh is currently rendered. Selecting a building retrieves its complete source before adopting its real contour, courtyards, sections and roofs. Settings icons remain usable at facade height and have a screen-space size. The roof/facade index covers all original ground and facade bounds, including walls outside a partial roof wing. Existing building storeys default to 3 m, while original top height and explicitly edited profiles remain intact.

LoD2 wall and slab surfaces share the neutral facade material. Internal and duplicate coplanar prism faces are removed with consistent triangulation, reducing the speckles and overlapping bands without losing individual mining targets. Distinct buildings retain their separate ownership and removed cells stay removed. Facade recovery uses the importer's canonical source-cell address, including the boundary tolerance: removing an overlapping diagonal voxel cannot transfer its visible bodies to a surviving neighbor or duplicate them across a chunk boundary.

## Loading and performance

- A progressive chunk packet could requeue an already-running mesh job, causing a valid completed result to be discarded repeatedly. Current results are now installed; genuinely changed self, neighbor or roof revisions still invalidate stale work.
- Construction wall/slab geometry is built in the existing chunk worker. The main thread installs typed geometry buffers and maps hit ranges back to the original construction cells. The synchronous fallback is retained.
- Scene target-cell and terrain-mesh indices are reused between mesh changes. OSM overlay source synchronization skips unchanged mesh lists.
- Backend JSON normalization avoids recursive calls for ordinary scalar values. An exact, bounded coordinate-projection cache reuses shared WFS vertices within the same reference frame; clipping and coordinate results are unchanged.

Read-only measurements use 96 stored Berlin chunks. They are component measurements, not an end-to-end FPS or loading-time guarantee:

| Measurement | Before | After |
| --- | ---: | ---: |
| Construction geometry work on main thread | 250.79 ms | 46.71 ms |
| Largest measured per-chunk main-thread construction task | 37.82 ms | 8.73 ms |
| Construction triangles | 188,912 | 79,658 |
| Exact facade triangles | 32,508 | 13,036 |
| Instrumented backend serialization audit, total | 15.940 s | 9.595 s |

Worker and synchronous output matched exactly across 253 construction groups, 79,658 triangles and 15,421 mining ranges. Facade material draws fell to one per facade chunk. Across chunk borders, opposing interior contact faces remain intentionally closed for independent streaming; no duplicate same-facing exterior triangles remained in the audit. Exact LoD2 wall caps still run on the main thread, and cold geodata attachment can still produce a longer task.

The final mining correction changed only three facade bodies whose canonical source cells were already air in the stored snapshots: `(5,23,57)`, `(6,23,57)` and `(2,43,56)`. Previously a neighboring wall cell incorrectly filled these openings. Removing 12 incorrect face triangles and exposing 20 legitimate opening-edge triangles explains the final increase from 13,028 to 13,036 facade triangles. Every other facade triangle is unchanged.

## Verification

- Full `npm run check` passed, including streaming/index reuse, construction worker, discovery, geometry, storeys, inventory, bootstrap and command tests, TypeScript and Vite build.
- Final source changes: 33 discovery/contour tests, 24 facade/roof rendering tests, TypeScript and a fresh production build passed. The facade suite now runs in `npm run check`; new regression cases cover overlapping mining ownership, rounded chunk boundaries and narrow gable caps.
- Backend: 23 planning-removal/dataset tests passed, including isolated real-Berlin replay, rollback, facade preservation and reload tombstones. JSON/coordinate-cache regressions: 11 passed.
- Browser fixture using the actual SceneRuntime and Worker passed progressive requeue, stale revision, neighbor occlusion and construction/mining identity checks.
- Browser Controller panel fixture passed tool activation without a panel, local draft edits, confirmation and selection cleanup.
- Real-Berlin Controller fixture passed all four phases: facade selection without an installed roof mesh, complete 23-roof adoption, floor-boundary interaction/drag cancellation, and single-roof deletion with continuing facade/storey editing. Writes were intercepted in the fixture.
- Visual inspection used the production renderer and geographic camera with the stored Berlin geometry. The inspected facade surfaces had no white speckles.

The protected end-user editor requires the user's authenticated browser session. The above fixtures exercise production controllers/rendering with real stored data but do not replace an entire walkthrough in that session. No historical building repair or live project edit was performed in this follow-up; database replay cases use separate test worlds and roll back.

## Local deployment

Editor and Chunk were rebuilt and recreated locally at approximately 21:09 CEST. Both containers report `running healthy`; the Chunk HTTP health endpoint returns `ok: true`. The served manifest points to `assets/main-DWA90HPI.js`. Every manifest asset and `assets/chunk_mesh_worker-CahaurgO.js` returned HTTP 200. Live structure polling also returned HTTP 200 after restart.

Startup logging included one realtime WebSocket send failure (`Bad file descriptor`) seven seconds after startup; subsequent health, static assets and structure requests succeeded. No realtime implementation change was made in this follow-up.

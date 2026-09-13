# Terrain map coordinates

The persisted EarthGrid uses **X east, Y up, Z north**. This is a left-handed
basis. Keep these storage coordinates, building positions, picking addresses and
XYZ map coordinates unchanged.

The main editor uses `GeographicPerspectiveCamera` to reflect camera right.
Its matrix overrides retain the reflection for projection and raycasting; Three's
standard camera strips scale from its view matrix. `renderGeographicScene` reflects
scene and render camera together during the GPU pass so ordinary face culling,
lighting, shadows and instancing remain valid. It restores logical world matrices
after every pass, including errors. Editor rendering must use this helper.
Generator and scanned-document previews retain their own standard camera basis.

XYZ tile rows increase southward. `osmGeometryUvs` calculates geographic UVs in
CPU double precision. The texture upload uses `flipY=true`, and the tile shader
samples `(u, 1-v)`. Do not flip these UVs to fix label orientation: that would move
features inside each tile and break geographic continuity across tile edges.

## Shared OpenLayer basemap

The editor root supplies `data-terrain-map-renderer-url` pointing to OpenLayer's
`/map/terrain`. Configure `OPENLAYER_PUBLIC_URL` consistently in App and Editor
(Editor also accepts `VECTOPLAN_EDITOR_OPENLAYER_PUBLIC_URL`). Local loopback
hosts follow the App iframe rule so the map and renderer share one storage origin.

OpenLayer's `static/js/basemap.js` owns both 2D and 3D policy: selected light/dark,
Mapbox first, matching OpenFreeMap style second, OSM last. `/map/terrain` reads the
same `vectoplan-openlayer:map-design` preference and handles `storage` changes.
It draws public raster/vector sources with OpenLayers and exports the center XYZ
tile of a buffered 768-pixel viewport. RGBA buffers cross an origin- and window-
checked `vectoplan-terrain-map.v1` bridge. Rendering stays in the browser; Chunk
continues supplying terrain and geographic references, with no persisted imagery.

Only four requests are outstanding and at most 192 textures retained. Switching
design or provider invalidates the texture generation; late responses cannot
restore an obsolete theme. Export queues are bounded and time out. If the renderer
service cannot initialize, the editor silently uses its final OSM raster fallback.
Attribution appears once outside the textures and tracks the provider in use.

`tests/browser_terrain_map.cjs` runs against the isolated OpenLayer browser fixture
on port 5191 (Playwright/Edge and esbuild required). It checks real light/dark
OpenFreeMap rendering, cross-origin storage updates, Mapbox priority and both
fallback stages, and cleanup. It also runs the actual geographic-camera GPU
boundary test: FrontSide screen-space line quads are entirely culled by the scene
reflection; DoubleSide restores blue pixels while retaining terrain depth tests.
Chunk's live boundary metadata remains the source of the lines.

## Legacy standalone raster sources

The editor root may supply JSON in `data-terrain-map-provider`:

```json
{
  "id": "light",
  "label": "Light map",
  "tileUrl": "/map-tiles/light/{z}/{x}/{y}.png",
  "attribution": {
    "label": "Map provider attribution",
    "url": "https://example.org/attribution"
  }
}
```

Sources use the same standard XYZ scheme and fixed detail level. The tile cache,
georeferencing and terrain geometry are independent of the provider. Failed
configured-source requests fall back to OpenStreetMap while retaining the four
concurrent request limit. These settings apply to standalone uses without the
shared renderer URL. The legacy
`data-osm-tile-url` proxy setting remains supported, also with public OSM fallback.

`tests/geographic_camera.test.ts` verifies projection, picking, control direction,
compass bearings and restoration. `tests/terrain_map_provider.test.ts` and the
terrain surface suite verify fallback and stable tile reuse. The browser fixture
`tests/browser/terrain_orientation_audit.ts` additionally checks actual GPU pixels,
front-facing roof surfaces, shadows and sprites, with an optional real Berlin tile.

import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";

import { createGeodataOverlayScene } from "../src/frontend/render/geodata_overlay_scene";
import type { RuntimeChunkContent } from "../src/frontend/runtime/world/chunk_content";
import type { ChunkRegistryHandle } from "../src/frontend/runtime/world/chunk_registry";

function createChunk(
  loadedAt: string,
  cells: readonly number[],
  chunkX = 0,
  metadata: Record<string, unknown> = {},
): RuntimeChunkContent {
  const terrainEntry = {
    cellValue: 1,
    blockTypeId: "system_terrain_test",
    solid: true,
    metadata: { role: "terrain" },
  };
  const structureEntry = {
    cellValue: 2,
    blockTypeId: "lod2_exterior_wall",
    solid: true,
    metadata: { role: "building-wall" },
  };
  return {
    kind: "runtime-chunk-content.v1",
    projectId: "project",
    universeId: "universe",
    worldId: "world",
    chunkKey: `${chunkX}:0:0`,
    chunkX,
    chunkY: 0,
    chunkZ: 0,
    chunkSize: 2,
    cellSize: 1,
    cells,
    palette: [terrainEntry, structureEntry],
    paletteByCellValue: new Map([[1, terrainEntry], [2, structureEntry]]),
    paletteByBlockTypeId: new Map([
      [terrainEntry.blockTypeId, terrainEntry],
      [structureEntry.blockTypeId, structureEntry],
    ]),
    stats: {
      cellCount: cells.length,
      airCellCount: cells.filter((value) => value === 0).length,
      nonAirCellCount: cells.filter((value) => value !== 0).length,
      solidCellCount: cells.filter((value) => value !== 0).length,
      nonSolidCellCount: 0,
      paletteBlockCount: 2,
      uniqueCellValues: [...new Set(cells)],
    },
    source: "snapshot",
    snapshotId: "snapshot",
    chunkRevision: 1,
    chunkVersion: "version",
    loadedAt,
    raw: { metadata },
  } as unknown as RuntimeChunkContent;
}

test("reuses unchanged surface data and recomputes only after a chunk revision change", () => {
  const parent = new THREE.Group();
  let chunk = createChunk("first", [1, 0, 0, 0, 0, 0, 0, 0]);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent });

  scene.syncFromRegistry(registry, "initial");
  const firstSurface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  assert.equal(firstSurface.get("0:0"), 1);

  scene.syncFromRegistry(registry, "unchanged");
  assert.equal(scene.getGroup().userData.surfaceCellY, firstSurface);

  chunk = createChunk("second", [0, 0, 1, 0, 0, 0, 0, 0]);
  scene.syncFromRegistry(registry, "changed");
  const changedSurface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  assert.notEqual(changedSurface, firstSurface);
  assert.equal(changedSurface.get("0:0"), 2);

  scene.dispose("test-complete");
});

test("road and parcel guides follow fractional terrain, including the empty part of a steep cut cell", () => {
  const chunk=createChunk('cut-terrain',Array(8).fill(1),0,{terrainSurface:{
    schemaVersion:'terrain-cut-cells.v1',cornerHeights:[.2,1,1.8,.2,1,1.8,.2,1,1.8],
  }});
  const registry={getVisibleChunkKeys:()=>[chunk.chunkKey],getChunk:()=>chunk,hasChunk:()=>true} as unknown as ChunkRegistryHandle;
  const scene=createGeodataOverlayScene({parent:new THREE.Group()});
  scene.syncFromRegistry(registry,'cut-terrain');
  const surface=scene.getGroup().userData.surfaceCellY as ReadonlyMap<string,number>;
  assert.ok(Math.abs(surface.get('0:0')!-.6)<1e-6);
  assert.ok(Math.abs(surface.get('1:0')!-1.4)<1e-6);
  scene.dispose('test-complete');
});

test("rescans only the visible chunk whose content revision changed", () => {
  function countingCells(values: readonly number[]) {
    let reads = 0;
    const cells = new Proxy([...values], {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) reads += 1;
        return Reflect.get(target, property, receiver);
      },
    });
    return { cells, reads: () => reads };
  }

  const firstCells = countingCells([1, 0, 0, 0, 0, 0, 0, 0]);
  const secondCells = countingCells([1, 0, 0, 0, 0, 0, 0, 0]);
  const chunks = new Map<string, RuntimeChunkContent>([
    ["0:0:0", createChunk("first-a", firstCells.cells, 0)],
    ["1:0:0", createChunk("first-b", secondCells.cells, 1)],
  ]);
  const registry = {
    getVisibleChunkKeys: () => [...chunks.keys()],
    getChunk: (key: string) => chunks.get(key) ?? null,
    hasChunk: (key: string) => chunks.has(key),
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "initial");
  const firstChunkReadsAfterInitialSync = firstCells.reads();
  assert.ok(firstChunkReadsAfterInitialSync > 0);
  assert.ok(secondCells.reads() > 0);

  const changedSecondCells = countingCells([0, 0, 1, 0, 0, 0, 0, 0]);
  chunks.set("1:0:0", createChunk("second-b", changedSecondCells.cells, 1));
  scene.syncFromRegistry(registry, "one-chunk-changed");

  assert.equal(firstCells.reads(), firstChunkReadsAfterInitialSync);
  assert.ok(changedSecondCells.reads() > 0);
  scene.dispose("test-complete");
});

test("uses the lowest solid top as ground fallback instead of draping roads over roofs", () => {
  const chunk = createChunk("building-column", [2, 0, 2, 0, 0, 0, 0, 0]);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "building-column-fallback");
  const surface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;

  assert.equal(surface.get("0:0"), 1);
  scene.dispose("test-complete");
});

test("hides redundant white street reference ribbons while retaining user blocks and source metadata", () => {
  const metadata = {
    geodataOverlays: {
      schemaVersion: "geodata-overlays.v1",
      items: [{
        id: "street-network",
        datasetId: "strassendaten",
        label: "Strassen- und Wegenetz",
        releaseKey: "live:public:public:strassendaten",
        tileKey: "0:0",
        renderMode: "surface-ribbons",
        semanticRole: "street-network",
        classificationSource: true,
        style: {
          color: "#6f7782",
          opacity: 1,
          lineWidth: 1,
          surfaceWidth: 1.5,
          verticalOffset: 0.025,
          sampleStep: 0.25,
        },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [[[0.1, 0.25], [1.75, 0.25]]],
        },
      }],
    },
  };
  const chunk = createChunk("street", [1, 2, 1, 1, 0, 0, 0, 0], 0, metadata);
  const originalCells=[...chunk.cells];
  const originalMetadata=JSON.stringify(chunk.raw.metadata);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  const stats = scene.syncFromRegistry(registry, "street-ribbon");
  const road = scene.getGroup().getObjectByName("geodata_overlay_street-network");

  assert.equal(road,undefined);
  const casing = scene.getGroup().getObjectByName("geodata_overlay_street-network_casing");
  assert.equal(casing,undefined);
  assert.equal(stats.objectCount,0);
  assert.deepEqual(chunk.cells,originalCells);
  assert.equal(JSON.stringify(chunk.raw.metadata),originalMetadata);
  scene.dispose("test-complete");
});

test("renders blue parcel boundaries at a real three-pixel width without white street overlays", () => {
  const metadata = {
    geodataOverlays: {
      schemaVersion: "geodata-overlays.v1",
      items: [{
        id: "parcel-boundaries",
        datasetId: "flurstuecke",
        label: "Flurstuecksgrenzen",
        releaseKey: "live:parcels",
        tileKey: "0:0",
        renderMode: "surface-lines",
        semanticRole: "parcel-boundary",
        classificationSource: false,
        style: { color: "#1687ff", opacity: 1, lineWidth: 1, verticalOffset: 0.015, sampleStep: 0.25 },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [
            [[0, 0], [2, 0]],
            [[0, 0.5], [2, 0.5]],
          ],
        },
      }, {
        id: "street-network",
        datasetId: "strassendaten",
        label: "Strassen- und Wegenetz",
        releaseKey: "live:streets",
        tileKey: "0:0",
        renderMode: "surface-ribbons",
        semanticRole: "street-network",
        classificationSource: true,
        style: { color: "#6f7782", opacity: 1, lineWidth: 1, surfaceWidth: 12, verticalOffset: 0.03, sampleStep: 0.25 },
        geometry: {
          type: "MultiLineString",
          dimensions: "world-xz",
          coordinates: [[[0.1, 0.25], [1.75, 0.25]]],
        },
      }],
    },
  };
  const chunk = createChunk("narrow-street", [1, 1, 1, 1, 0, 0, 0, 0], 0, metadata);
  const registry = {
    getVisibleChunkKeys: () => [chunk.chunkKey],
    getChunk: (key: string) => key === chunk.chunkKey ? chunk : null,
    hasChunk: (key: string) => key === chunk.chunkKey,
  } as unknown as ChunkRegistryHandle;
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() });

  scene.syncFromRegistry(registry, "narrow-street");
  assert.equal(scene.getGroup().getObjectByName("geodata_overlay_street-network"),undefined);
  assert.equal(scene.getGroup().getObjectByName("geodata_overlay_street-network_casing"),undefined);
  const boundary=scene.getGroup().getObjectByName("geodata_overlay_parcel-boundaries") as LineSegments2;
  assert.ok(boundary instanceof LineSegments2);
  assert.equal(boundary.material.color.getHexString(),'1687ff');
  assert.equal(boundary.material.linewidth,3);
  assert.equal(boundary.material.side, THREE.DoubleSide);
  assert.equal(boundary.material.worldUnits,false);
  assert.ok(boundary.geometry.getAttribute('instanceStart').count>0);
  assert.equal(boundary.userData.affectsVoxelState,false);
  scene.dispose("test-complete");
});


function parcelMetadata(endX = 1.75): Record<string, unknown> {
  return { geodataOverlays: { schemaVersion: "geodata-overlays.v1", items: [{
    id: "parcel-cache-test", datasetId: "flurstuecke", releaseKey: "parcel-v1", tileKey: "0:0",
    renderMode: "surface-lines", semanticRole: "parcel-boundary",
    style: { color: "#1687ff", sampleStep: 0.25, verticalOffset: 0.015 },
    geometry: { type: "MultiLineString", dimensions: "world-xz", coordinates: [[[0.1, 0.25], [endX, 0.25]]] },
  }] } };
}
function registryFor(chunks: Map<string, RuntimeChunkContent>, visible: () => string[] = () => [...chunks.keys()]): ChunkRegistryHandle {
  return { getVisibleChunkKeys: visible, getChunk: (key: string) => chunks.get(key) ?? null,
    hasChunk: (key: string) => chunks.has(key) } as unknown as ChunkRegistryHandle;
}
function boundary(scene: ReturnType<typeof createGeodataOverlayScene>): LineSegments2 {
  return scene.getGroup().getObjectByName("geodata_overlay_parcel-cache-test") as LineSegments2;
}

test("retains parcel GPU buffers for unrelated terrain edits and upper building arrivals, but invalidates changed sampled heights", () => {
  const metadata = parcelMetadata();
  const chunks = new Map([
    ["0:0:0", createChunk("base", [1, 1, 0, 0, 0, 0, 0, 0], 0, metadata)],
    ["1:0:0", createChunk("outside", [1, 0, 0, 0, 0, 0, 0, 0], 1)],
  ]);
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() }), registry = registryFor(chunks);
  scene.syncFromRegistry(registry);
  const original = boundary(scene), oldSurface = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  let disposed = false; original.geometry.addEventListener("dispose", () => { disposed = true; });
  chunks.set("1:0:0", createChunk("outside-raised", [0, 0, 1, 0, 0, 0, 0, 0], 1));
  scene.syncFromRegistry(registry);
  assert.equal(boundary(scene), original);
  const upper = { ...createChunk("upper-building", Array(8).fill(2)), chunkY: 1, chunkKey: "0:1:0" } as RuntimeChunkContent;
  chunks.set(upper.chunkKey, upper); scene.syncFromRegistry(registry);
  assert.equal(boundary(scene), original); assert.equal(disposed, false);
  chunks.set("0:0:0", createChunk("sampled-raised", [0, 0, 1, 1, 0, 0, 0, 0], 0, metadata));
  scene.syncFromRegistry(registry);
  assert.notEqual(boundary(scene), original); assert.equal(disposed, true);
  const updated = scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>;
  assert.equal(oldSurface.get("0:0"), 1, "old readers retain an immutable height snapshot");
  assert.equal(updated.get("0:0"), 2);
  assert.equal(new Map(updated).size, updated.size);
  assert.deepEqual([...updated.keys()].sort(), [...updated.entries()].map(([key]) => key).sort());
  const visited = new Map<string, number>(); updated.forEach((value, key) => visited.set(key, value));
  assert.deepEqual(visited, new Map(updated));
  scene.dispose();
});

test("invalidates previously missing terrain samples on arrival and visibility changes, without changing source geometry", () => {
  const chunks = new Map([
    ["0:0:0", createChunk("base", [1, 1, 0, 0, 0, 0, 0, 0], 0, parcelMetadata(3.75))],
    ["1:0:0", createChunk("neighbor", [1, 1, 0, 0, 0, 0, 0, 0], 1)],
  ]);
  let visible = ["0:0:0"];
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() }), registry = registryFor(chunks, () => visible);
  const first = scene.syncFromRegistry(registry), firstGeometry = boundary(scene).geometry;
  visible = [...chunks.keys()]; const both = scene.syncFromRegistry(registry);
  assert.ok(both.renderedSegmentCount > first.renderedSegmentCount);
  assert.notEqual(boundary(scene).geometry, firstGeometry);
  visible = ["0:0:0"]; const hidden = scene.syncFromRegistry(registry);
  assert.equal(hidden.renderedSegmentCount, first.renderedSegmentCount);
  assert.equal(hidden.surfaceCellCount, first.surfaceCellCount);
  scene.dispose();
});

test("invalidates changed overlay metadata and disposes retired overlays while keeping the terrain snapshot correct", () => {
  const chunks = new Map([["0:0:0", createChunk("original", [1, 1, 0, 0, 0, 0, 0, 0], 0, parcelMetadata(0.75))]]);
  const scene = createGeodataOverlayScene({ parent: new THREE.Group() }), registry = registryFor(chunks);
  const first = scene.syncFromRegistry(registry), original = boundary(scene);
  chunks.set("0:0:0", createChunk("source-changed", [1, 1, 0, 0, 0, 0, 0, 0], 0, parcelMetadata(1.75)));
  const changed = scene.syncFromRegistry(registry);
  assert.notEqual(boundary(scene), original); assert.ok(changed.renderedSegmentCount > first.renderedSegmentCount);
  const replacement = boundary(scene); let disposed = false;
  replacement.geometry.addEventListener("dispose", () => { disposed = true; });
  chunks.set("0:0:0", createChunk("source-removed", [1, 1, 0, 0, 0, 0, 0, 0]));
  scene.syncFromRegistry(registry);
  assert.equal(boundary(scene), undefined); assert.equal(disposed, true);
  assert.equal((scene.getGroup().userData.surfaceCellY as ReadonlyMap<string, number>).get("0:0"), 1);
  scene.dispose();
});

import type { PathBrushDraft, PathBrushPoint } from "../shared/path_brush_geometry";
import type { LineBrushBuildingLayout } from "./building_layout";
import { LEGACY_STANDARD_STOREY_HEIGHT_METERS } from "./building_programs";
import { LOD2_STANDARD_STOREY_HEIGHT_METERS, createStoreyHeightProfile, storeyScopeBoundaries,
  type BuildingStoreyHeightProfile } from "../storey/height_profile";
import { contourRoofComponentIndex } from "./contour_roofs";
import { ensureContourBuildingPartitions, refitContourBuildingPartitions, contourBuildingScopes, contourRoofScopeIndex,
  type ContourStoreyPartition } from "./contour_partitions";
export { contourBuildingRoofs, contourRoofComponentIndex } from "./contour_roofs";
export { ensureContourBuildingPartitions, contourBuildingScopes, contourRoofScopeIndex, remapContourStoreyHeightProfile } from "./contour_partitions";

/** GroundSurface contours, not a reconstruction from roof bounds or centrelines. */
export const CONTOUR_BUILDING_SCHEMA_VERSION = "vectoplan.contour-building.v1" as const;
export type ContourBuildingFootprint = PathBrushDraft["footprint"];
type Point = readonly [number, number];
type Ring = readonly Point[];
type RecordValue = Readonly<Record<string, unknown>>;

export interface ContourBuildingRoof {
  readonly objectInstanceId: string;
  readonly anchor: Readonly<{ x: number; y: number; z: number }>;
  readonly footprint: RecordValue;
  readonly parameters: RecordValue;
  readonly calculation: RecordValue;
  readonly eavesY: number;
  readonly storeyCount: number;
  readonly facadeSource?: RecordValue;
}

export interface ContourBuildingMetadata {
  readonly schemaVersion: typeof CONTOUR_BUILDING_SCHEMA_VERSION;
  readonly footprint: ContourBuildingFootprint;
  readonly activePolygonIndex: number;
  readonly activeRingIndex: number;
  readonly baseY: number;
  readonly preserveImportedRoof?: boolean;
  readonly storeyPartitions?: readonly ContourStoreyPartition[];
  readonly source?: Readonly<{
    kind: "lod2";
    buildingId: string;
    roofObjectIds: readonly string[];
    originalEavesY: number;
    originalStoreyCount: number;
    /** Missing on persisted legacy contours means 2.645m, never the new default. */
    standardStoreyHeightMeters?: number;
    originalFootprint: ContourBuildingFootprint;
    /** Actual component counts when separately edited roofs are adopted again. */
    originalComponentStoreyCounts?: Readonly<Record<string, number>>;
    /** Partition IDs, never component positions, bind variable storey counts. */
    originalPartitionStoreyCounts?: Readonly<Record<string, number>>;
    /** Preserve individual annex heights and edited roof surfaces. */
    roofs: readonly ContourBuildingRoof[];
    facadeSegments: readonly RecordValue[];
    originalWallBounds: Readonly<{ minimum: PathBrushPoint; maximum: PathBrushPoint }>;
  }>;
}

const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value)
  ? value as RecordValue : {};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const area = (ring: Ring): number => ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length]!;
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
const same = (a: Point, b: Point): boolean => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8;
const cross = (a: Point, b: Point, c: Point): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.abs(cross(a, b, p)) < 1e-8 && p[0] >= Math.min(a[0], b[0]) - 1e-8
    && p[0] <= Math.max(a[0], b[0]) + 1e-8 && p[1] >= Math.min(a[1], b[1]) - 1e-8
    && p[1] <= Math.max(a[1], b[1]) + 1e-8;
}
function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  return cross(a, b, c) * cross(a, b, d) < -1e-12 && cross(c, d, a) * cross(c, d, b) < -1e-12
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function inside(p: Point, ring: Ring): boolean {
  let result = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!, b = ring[j]!;
    if (onSegment(a, b, p)) return false;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function ringsIntersect(a: Ring, b: Ring): boolean {
  return a.some((p, i) => b.some((q, j) => intersects(p, a[(i + 1) % a.length]!, q, b[(j + 1) % b.length]!)));
}
function normalizeRing(value: unknown): Ring | null {
  if (!Array.isArray(value) || value.length > 8192) return null;
  const ring: Point[] = [];
  for (const p of value) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) return null;
    const point: Point = [p[0], p[1]];
    if (!ring.length || !same(ring.at(-1)!, point)) ring.push(point);
  }
  if (ring.length > 1 && same(ring[0]!, ring.at(-1)!)) ring.pop();
  if (ring.length < 3 || Math.abs(area(ring)) < 1e-6) return null;
  for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
    if (j === i + 1 || i === 0 && j === ring.length - 1) continue;
    if (intersects(ring[i]!, ring[(i + 1) % ring.length]!, ring[j]!, ring[(j + 1) % ring.length]!)) return null;
  }
  return ring;
}

/** Reject invalid edits atomically; never drop an invalid hole or polygon. */
export function contourBuildingFootprint(value: unknown): ContourBuildingFootprint | null {
  const source = record(value);
  if (source.coordinateSpace !== undefined && source.coordinateSpace !== "world-cell-xz") return null;
  const raw = Array.isArray(value) ? value : source.type === "Polygon" ? [source.coordinates] : source.coordinates;
  if (!Array.isArray(raw) || !raw.length || raw.length > 256) return null;
  const coordinates: Ring[][] = [];
  for (const polygon of raw) {
    if (!Array.isArray(polygon) || !polygon.length) return null;
    const rings = polygon.map(normalizeRing);
    if (rings.some(ring => !ring)) return null;
    const outer = rings[0]!;
    for (let i = 1; i < rings.length; i++) {
      const hole = rings[i]!;
      if (!inside(hole[0]!, outer) || ringsIntersect(outer, hole)) return null;
      for (let j = 1; j < i; j++) if (ringsIntersect(hole, rings[j]!)
        || inside(hole[0]!, rings[j]!) || inside(rings[j]![0]!, hole)) return null;
    }
    coordinates.push(rings as Ring[]);
  }
  // Distinct solids may meet at a source boundary. Their interiors must not overlap.
  for (let i = 0; i < coordinates.length; i++) for (let j = 0; j < i; j++) {
    const a = coordinates[i]!, b = coordinates[j]!;
    const inSolid = (p: Point, polygon: Ring[]) => inside(p, polygon[0]!) && !polygon.slice(1).some(h => inside(p, h));
    if (a[0]!.some(p => inSolid(p, b)) || b[0]!.some(p => inSolid(p, a))) return null;
  }
  return { type: "MultiPolygon", coordinateSpace: "world-cell-xz", coordinates };
}

export function contourBuildingFromMetadata(value: unknown): ContourBuildingMetadata | null {
  const container = record(value), raw = record(container.contourBuilding ?? value);
  if (raw.schemaVersion !== CONTOUR_BUILDING_SCHEMA_VERSION || !Number.isFinite(raw.baseY)) return null;
  const footprint = contourBuildingFootprint(raw.footprint);
  const polygonIndex = Number(raw.activePolygonIndex ?? 0), ringIndex = Number(raw.activeRingIndex ?? 0);
  if (!footprint || !Number.isInteger(polygonIndex) || !Number.isInteger(ringIndex)
    || !footprint.coordinates[polygonIndex]?.[ringIndex]) return null;
  if (raw.storeyPartitions !== undefined && (!Array.isArray(raw.storeyPartitions) || raw.storeyPartitions.length > 256
    || raw.storeyPartitions.some(value => {
      const partition = record(value), shape = record(partition.footprint);
      return !partition.id || !Array.isArray(partition.roofObjectIds) || !Number.isFinite(partition.originalEavesY)
        || !Number.isInteger(partition.sourceComponentIndex)
        || !(Array.isArray(shape.coordinates) && shape.coordinates.length === 0) && !contourBuildingFootprint(shape);
    }) || new Set(raw.storeyPartitions.map(value => record(value).id)).size !== raw.storeyPartitions.length)) return null;
  return { ...clone(raw), schemaVersion: CONTOUR_BUILDING_SCHEMA_VERSION, footprint,
    baseY: Number(raw.baseY), activePolygonIndex: polygonIndex, activeRingIndex: ringIndex } as ContourBuildingMetadata;
}

export function replaceContourBuildingRing(metadata: ContourBuildingMetadata, points: readonly PathBrushPoint[],
  polygonIndex = metadata.activePolygonIndex, ringIndex = metadata.activeRingIndex): ContourBuildingMetadata | null {
  if (!metadata.footprint.coordinates[polygonIndex]?.[ringIndex]) return null;
  const coordinates = clone(metadata.footprint.coordinates) as Array<Array<Ring>>;
  coordinates[polygonIndex]![ringIndex] = points.map(point => [point.x, point.z] as const);
  const footprint = contourBuildingFootprint(coordinates);
  return footprint ? { ...metadata, footprint, activePolygonIndex: polygonIndex, activeRingIndex: ringIndex,
    ...(metadata.storeyPartitions ? {storeyPartitions: refitContourBuildingPartitions(metadata, footprint)} : {}) } : null;
}

export function createContourBuildingDraft(metadata: ContourBuildingMetadata,
  replacementPoints?: readonly PathBrushPoint[]): PathBrushDraft | null {
  const current = replacementPoints ? replaceContourBuildingRing(metadata, replacementPoints) : metadata;
  if (!current) return null;
  const point = ([x, z]: Point): PathBrushPoint => ({ x, y: current.baseY, z });
  const points = current.footprint.coordinates[current.activePolygonIndex]![current.activeRingIndex]!.map(point);
  const all = current.footprint.coordinates.flatMap(polygon => polygon.flat());
  const scopes = contourBuildingScopes(current);
  const segments = scopes.map(({footprint: shape, index}) => {
    const ring = shape.coordinates.reduce((best, polygon) => Math.abs(area(polygon[0]!)) > Math.abs(area(best[0]!)) ? polygon : best)[0]!;
    let edge = 0, length = 0;
    ring.forEach((p, i) => { const q = ring[(i + 1) % ring.length]!, next = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (next > length) { edge = i; length = next; } });
    return { index, start: point(ring[edge]!), end: point(ring[(edge + 1) % ring.length]!), length, rectangle: ring };
  });
  return { schemaVersion: "vectoplan-path-brush-draft.v1", kind: "building", footprintMode: "contour",
    interpolation: "linear", width: 1, points, centerline: [], segments,
    ...(current.storeyPartitions ? {contourScopeFootprints: Object.fromEntries(scopes.map(scope => [String(scope.index), scope.footprint])),
      contourScopeIds: Object.fromEntries(scopes.map(scope => [String(scope.index), scope.id]))} : {}),
    polygons: scopes.flatMap(({footprint: shape, index: segmentIndex}) => shape.coordinates.map(polygon => ({ role: "segment" as const, segmentIndex,
      coordinates: polygon[0]!, holes: polygon.slice(1) }))), footprint: current.footprint,
    bounds: { minimum: { x: Math.min(...all.map(p => p[0])), y: current.baseY, z: Math.min(...all.map(p => p[1])) },
      maximum: { x: Math.max(...all.map(p => p[0])), y: current.baseY, z: Math.max(...all.map(p => p[1])) } },
    estimatedAreaM2: current.footprint.coordinates.reduce((sum, polygon) => sum + Math.abs(area(polygon[0]!))
      - polygon.slice(1).reduce((holes, ring) => holes + Math.abs(area(ring)), 0), 0) };
}

export function contourBuildingLayout(draft: PathBrushDraft): LineBrushBuildingLayout {
  return { schemaVersion: "vectoplan.line-brush-building-layout.v1", typeId: "standard", footprint: draft.footprint,
    bySegment: draft.contourScopeFootprints ? Object.fromEntries(Object.entries(draft.contourScopeFootprints).map(([key, shape]) => [key, shape.coordinates]))
      : Object.fromEntries(draft.footprint.coordinates.map((polygon, index) => [String(index), [polygon]])),
    moduleCount: draft.segments.length, effectiveDepthMeters: 1, clearGapMeters: 0 };
}

/** Supply every loaded roof of one building; duplicated chunk references are harmless. */
export function contourBuildingFromLod2(refs: readonly unknown[]): ContourBuildingMetadata | null {
  const roofs: ContourBuildingRoof[] = [], facadeSegments: RecordValue[] = [];
  const roofIds = new Set<string>(), facadeKeys = new Set<string>();
  let buildingId = "", footprint: ContourBuildingFootprint | null = null;
  for (const value of refs) {
    const ref = record(value), metadata = record(ref.metadata), parameters = record(metadata.roofParameters);
    const source = record(parameters.importedSource), id = String(metadata.lod2BuildingId ?? source.buildingId ?? "");
    if (!["building_roof", "building_facade_source"].includes(String(ref.objectTypeId)) || !id) continue;
    if (buildingId && buildingId !== id) return null;
    buildingId = id;
    if (!footprint) footprint = contourBuildingFootprint(source.groundFootprints);
    for (const facade of Array.isArray(source.facadeSegments) ? source.facadeSegments : []) {
      const segment = record(facade), key = JSON.stringify(segment);
      if (Number.isFinite(segment.minimumY) && Number.isFinite(segment.maximumY) && !facadeKeys.has(key)) {
        facadeKeys.add(key); facadeSegments.push(clone(segment));
      }
    }
    const objectInstanceId = String(ref.objectInstanceId ?? "");
    if (!objectInstanceId || roofIds.has(objectInstanceId)) continue;
    const eavesY = Number(parameters.eavesHeightMm) / 1000;
    if (!Number.isFinite(eavesY)) return null;
    roofIds.add(objectInstanceId);
    roofs.push({ objectInstanceId, anchor: clone(ref.anchor) as ContourBuildingRoof["anchor"],
      footprint: clone(record(ref.footprint)), parameters: clone(parameters),
      calculation: clone(record(metadata.roofCalculation)), eavesY, storeyCount: 1,
      ...(ref.objectTypeId === "building_facade_source" ? { facadeSource: clone(record(metadata.lod2FacadeSource)) } : {}) });
  }
  if (!buildingId || !footprint || !facadeSegments.length || !roofs.length) return null;
  const baseY = Math.min(...facadeSegments.map(segment => Number(segment.minimumY)));
  const originalEavesY = Math.max(...roofs.map(roof => roof.eavesY));
  const count = (eaves: number) => Math.max(1, Math.ceil((eaves - baseY - 1e-6) / LOD2_STANDARD_STOREY_HEIGHT_METERS));
  const draft = createContourBuildingDraft({ schemaVersion: CONTOUR_BUILDING_SCHEMA_VERSION, footprint,
    activePolygonIndex: 0, activeRingIndex: 0, baseY })!;
  const metadata: ContourBuildingMetadata = { schemaVersion: CONTOUR_BUILDING_SCHEMA_VERSION, footprint, activePolygonIndex: 0, activeRingIndex: 0, baseY,
    preserveImportedRoof: true,
    source: { kind: "lod2", buildingId, roofObjectIds: [...new Set(roofs.map(roof => String(roof.facadeSource?.originalRoofObjectInstanceId ?? roof.objectInstanceId)))], originalEavesY,
      standardStoreyHeightMeters: LOD2_STANDARD_STOREY_HEIGHT_METERS,
      originalFootprint: clone(footprint), originalStoreyCount: count(originalEavesY),
      roofs: roofs.map(roof => ({ ...roof, storeyCount: count(roof.eavesY) })),
      facadeSegments, originalWallBounds: { minimum: draft.bounds.minimum,
        maximum: { ...draft.bounds.maximum, y: Math.max(...facadeSegments.map(segment => Number(segment.maximumY))) } } } };
  return ensureContourBuildingPartitions(metadata);
}

/** Legacy converted contours keep their original standard on every refetch. */
export function contourBuildingStandardHeight(metadata: ContourBuildingMetadata): number {
  const value = metadata.source?.standardStoreyHeightMeters;
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= 1000
    ? value : LEGACY_STANDARD_STOREY_HEIGHT_METERS;
}

/** Original eaves per true GroundSurface component, relative to the stable base.
 * Never use roof bounding-box centres, which may lie in a courtyard. */
export function contourBuildingScopeTopHeights(metadata: ContourBuildingMetadata): Readonly<Record<string, number>> {
  if (!metadata.source) return {};
  const result: Record<string, number> = {all: metadata.source.originalEavesY - metadata.baseY};
  contourBuildingScopes(metadata).forEach(scope => {
    result[`segment:${scope.index}`] = scope.originalEavesY - metadata.baseY;
  });
  return result;
}

export function contourBuildingHeightProfile(metadata: ContourBuildingMetadata): BuildingStoreyHeightProfile {
  if (!metadata.source) throw new Error("Keine gespeicherte Bestandsgebäudehöhe vorhanden.");
  const heights = contourBuildingScopeTopHeights(metadata);
  return createStoreyHeightProfile({baseCount: metadata.source.originalStoreyCount,
    defaultHeightMeters: contourBuildingStandardHeight(metadata), topHeightMeters: heights.all,
    scopeTopHeights: heights, scopeCounts: metadata.storeyPartitions
      ? Object.fromEntries(contourBuildingScopes(metadata).flatMap(scope => metadata.source!.originalPartitionStoreyCounts?.[scope.id] === undefined
        ? [] : [[`segment:${scope.index}`, metadata.source!.originalPartitionStoreyCounts![scope.id]]]))
      : metadata.source.originalComponentStoreyCounts});
}

/** Refresh the editable baseline after an independent Roof WorldEdit operation.
 * The caller supplies the complete authoritative building read, not just the
 * currently streamed roof meshes. Import-cleanup provenance remains immutable. */
export function refreshContourBuildingRoofs(metadata: ContourBuildingMetadata, fullRoofObjectRefs: readonly unknown[],
  currentBaseStoreyCount: number, currentHeightProfile?: BuildingStoreyHeightProfile): ContourBuildingMetadata {
  if (!metadata.source || !Number.isInteger(currentBaseStoreyCount) || currentBaseStoreyCount < 1) {
    throw new Error("Keine gültige Bestandsgebäude-Basis für die aktualisierten Dächer vorhanden.");
  }
  const roofs: ContourBuildingRoof[] = [], seen = new Set<string>();
  for (const value of fullRoofObjectRefs) {
    const ref = record(value);
    if (!["building_roof", "building_facade_source"].includes(String(ref.objectTypeId))) continue;
    const id = String(ref.objectInstanceId ?? "");
    if (!id || seen.has(id)) continue;
    const properties = record(ref.metadata), parameters = record(properties.roofParameters);
    const calculation = record(properties.roofCalculation), geometry = record(calculation.geometry);
    const footprint = contourBuildingFootprint(ref.footprint), anchor = record(ref.anchor);
    const buildingId = String(properties.lod2BuildingId ?? record(parameters.importedSource).buildingId ?? "");
    const eavesY = Number(parameters.eavesHeightMm) / 1000;
    const faces = geometry.faces;
    if (buildingId && buildingId !== metadata.source.buildingId || !footprint || !Number.isFinite(eavesY)
      || eavesY <= metadata.baseY || ![anchor.x, anchor.y, anchor.z].every(Number.isFinite)
      || !Array.isArray(faces) || !faces.length || faces.length > 8192
      || !faces.every(face => Array.isArray(record(face).polygon_3d_mm)
        && (record(face).polygon_3d_mm as unknown[]).length >= 3
        && (record(face).polygon_3d_mm as unknown[]).every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)))) {
      throw new Error(`Das aktuelle Dach ${id} enthält keine vollständigen gültigen Gebäudedaten.`);
    }
    seen.add(id);
    roofs.push({ objectInstanceId: id, anchor: clone(anchor) as ContourBuildingRoof["anchor"], footprint: clone(record(ref.footprint)),
      parameters: clone(parameters), calculation: clone(calculation), eavesY,
      ...(ref.objectTypeId === "building_facade_source" ? { facadeSource: clone(record(properties.lod2FacadeSource)) } : {}),
      storeyCount: Math.max(1, Math.ceil((eavesY - metadata.baseY - 1e-6) / contourBuildingStandardHeight(metadata))) });
  }
  if (!roofs.length) throw new Error("Die aktuellen Dächer des Bestandsgebäudes fehlen. Das Gebäude wurde nicht neu aufgebaut.");
  let next: ContourBuildingMetadata = { ...metadata, source: { ...metadata.source,
    originalFootprint: clone(metadata.footprint), originalStoreyCount: currentBaseStoreyCount,
    originalEavesY: Math.max(...roofs.map(roof => roof.eavesY)), roofs } };
  if (currentHeightProfile) {
    const actualRoofs = roofs.map(roof => {
      const boundaries = storeyScopeBoundaries(currentHeightProfile, `segment:${contourRoofScopeIndex(next, roof)}`);
      const storeyCount = Math.max(1, boundaries.slice(0, -1).filter(bottom => bottom < roof.eavesY - metadata.baseY - 1e-6).length);
      return {...roof, storeyCount};
    });
    next = {...next, source: {...next.source!, roofs: actualRoofs}};
  }
  const componentCounts = Object.fromEntries(metadata.footprint.coordinates.map((_, index) => [String(index),
    currentHeightProfile && !next.storeyPartitions ? storeyScopeBoundaries(currentHeightProfile, `segment:${index}`).length - 1
      : Math.max(1, ...next.source!.roofs.filter(roof => contourRoofComponentIndex(next, roof) === index).map(roof => roof.storeyCount))]));
  if (next.storeyPartitions) {
    const scoped = next.storeyPartitions.map((partition, index) => {
      const assigned = next.source!.roofs.filter(roof => contourRoofScopeIndex(next, roof) === index);
      return assigned.length ? {...partition, roofObjectIds: assigned.map(roof => roof.objectInstanceId),
        originalEavesY: Math.max(...assigned.map(roof => roof.eavesY))} : partition;
    });
    const counts = Object.fromEntries(scoped.map((partition, index) => [partition.id,
      currentHeightProfile ? storeyScopeBoundaries(currentHeightProfile, `segment:${index}`).length - 1
        : Math.max(1, Math.ceil((partition.originalEavesY - metadata.baseY - 1e-6) / contourBuildingStandardHeight(metadata)))]));
    next = {...next, storeyPartitions: scoped, source: {...next.source!, originalPartitionStoreyCounts: counts}};
  }
  return { ...next, source: { ...next.source!, originalComponentStoreyCounts: componentCounts } };
}

/** Translate actual CAD positions; normals, member sizes and immutable source facets stay unchanged. */
export function translateContourRoofCalculation(calculation: RecordValue, deltaY: number, deltaX = 0, deltaZ = 0): RecordValue {
  if (![deltaX, deltaY, deltaZ].every(Number.isFinite)) throw new Error("Ungültiger Dachversatz.");
  const shiftPoints = (value: unknown): unknown => Array.isArray(value)
    ? value.length === 3 && value.every(Number.isFinite)
      ? [value[0] + deltaX * 1000, value[1] + deltaZ * 1000, value[2] + deltaY * 1000] : value.map(shiftPoints) : value;
  const visit = (value: unknown): unknown => Array.isArray(value) ? value.map(visit)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      key === "normalized_request" || key === "importedSource" || key === "imported_source" ? clone(item)
        : key.endsWith("_3d_mm") ? shiftPoints(item)
          : ["maximum_height_mm", "minimum_height_mm", "eaves_height_mm", "roof_zone_top_mm", "lowest_purlin_bottom_mm"].includes(key) && Number.isFinite(item)
            ? Number(item) + deltaY * 1000 : visit(item)])) : value;
  const result = visit(calculation) as Record<string, unknown>;
  result.input_fingerprint = `${calculation.input_fingerprint ?? calculation.calculation_id ?? "roof"}:building-shift:${deltaX}:${deltaY}:${deltaZ}`;
  result.calculation_id = result.input_fingerprint;
  const request = record(result.normalized_request), parameters = record(request.parameters);
  if (Number.isFinite(parameters.eaves_height_mm)) result.normalized_request = { ...request,
    parameters: { ...parameters, eaves_height_mm: Number(parameters.eaves_height_mm) + deltaY * 1000 } };
  if (deltaX || deltaZ) {
    const current = record(result.normalized_request), footprint = record(current.footprint);
    const shiftPlan = (value: unknown): unknown => Array.isArray(value)
      ? value.length === 2 && value.every(Number.isFinite) ? [value[0] + deltaX * 1000, value[1] + deltaZ * 1000]
        : value.map(shiftPlan) : value;
    if (Object.keys(footprint).length) result.normalized_request = { ...current, footprint: Object.fromEntries(
      Object.entries(footprint).map(([key, value]) => [key, key.endsWith("_mm") ? shiftPlan(value) : value])) };
  }
  return result;
}

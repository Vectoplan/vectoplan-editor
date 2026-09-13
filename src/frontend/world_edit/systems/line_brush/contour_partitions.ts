import { ShapeUtils, Vector2 } from "three";
import { unionPathBrushPlanPolygons } from "../shared/path_brush_geometry";
import { intersectConvexParcelGridPolygons, subtractConvexParcelGridPolygon, parcelGridPolygonArea, mergeParcelGridCoverage, mergeConvexParcelGridCoverage } from "../parcel_grid/geometry";
import { roofSurfaceTriangles } from "../../../scene/roof_surface_geometry";
import { contourRoofComponentIndex } from "./contour_roofs";
import { contourBuildingFootprint, type ContourBuildingMetadata, type ContourBuildingFootprint, type ContourBuildingRoof } from "./contour_building";
import { storeyScopeBoundaries, type BuildingStoreyHeightProfile } from "../storey/height_profile";

type Point = readonly [number, number];
type Polygon = readonly Point[];
export interface ContourStoreyPartition {
  readonly id: string;
  readonly footprint: ContourBuildingFootprint;
  readonly roofObjectIds: readonly string[];
  readonly sourceComponentIndex: number;
  readonly originalEavesY: number;
}
export interface ContourBuildingScope extends ContourStoreyPartition {
  /** Stable persisted position, including gaps left by deleted regions. */
  readonly index: number;
}
const footprint = (coordinates: ContourBuildingFootprint["coordinates"]): ContourBuildingFootprint =>
  ({type: "MultiPolygon", coordinateSpace: "world-cell-xz", coordinates});
function triangles(value: ContourBuildingFootprint): readonly Polygon[] {
  return value.coordinates.flatMap(polygon => {
    const points = polygon.flat();
    return ShapeUtils.triangulateShape(polygon[0]!.map(p => new Vector2(...p)), polygon.slice(1).map(ring => ring.map(p => new Vector2(...p))))
      .map(indices => indices.map(index => points[index]!));
  });
}
function area(value: ContourBuildingFootprint): number {
  return value.coordinates.reduce((sum, polygon) => sum + parcelGridPolygonArea(polygon[0]!)
    - polygon.slice(1).reduce((holes, ring) => holes + parcelGridPolygonArea(ring), 0), 0);
}
function distance(point: Point, polygon: Polygon): number {
  return Math.min(...polygon.map((a, index) => {
    const b = polygon[(index + 1) % polygon.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / Math.max(1e-12, dx * dx + dz * dz)));
    return (point[0] - a[0] - dx * t) ** 2 + (point[1] - a[1] - dz * t) ** 2;
  }));
}
function split(polygon: Polygon, a: Point, b: Point): readonly Polygon[] {
  const side = (p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (!polygon.some(p => side(p) > 1e-8) || !polygon.some(p => side(p) < -1e-8)) return [polygon];
  return [1, -1].map(sign => {
    const result: Point[] = [];
    polygon.forEach((p, index) => {
      const q = polygon[(index + 1) % polygon.length]!, u = sign * side(p), v = sign * side(q);
      if (u >= -1e-8) result.push(p);
      if (u > 1e-8 && v < -1e-8 || u < -1e-8 && v > 1e-8) result.push([
        p[0] + (q[0] - p[0]) * u / (u - v), p[1] + (q[1] - p[1]) * u / (u - v)]);
    }); return result;
  }).filter(ring => parcelGridPolygonArea(ring) > 1e-8);
}
const overlap = (first: readonly Polygon[], second: readonly Polygon[]): number => first.reduce((sum, a) => sum
  + second.reduce((value, b) => value + parcelGridPolygonArea(intersectConvexParcelGridPolygons(a, b)), 0), 0);
function merged(parts: readonly Polygon[]): ContourBuildingFootprint {
  if (!parts.length) return footprint([]);
  const significant = parts.filter(part => parcelGridPolygonArea(part) >= 1e-6);
  if (!significant.length) return footprint([]);
  let result = footprint(unionPathBrushPlanPolygons(significant).filter(polygon => parcelGridPolygonArea(polygon[0]!) >= 1e-6));
  const expected = parts.reduce((sum, part) => sum + parcelGridPolygonArea(part), 0);
  // Fine LoD2 slivers can defeat the sampled outline union. The shared grid's
  // edge-cancellation/convex merge retains the exact non-overlapping coverage;
  // disconnected polygons in one region also represent courtyard gaps exactly.
  if (Math.abs(area(result) - expected) > Math.max(.0001, expected * 1e-6))
    result = footprint(mergeParcelGridCoverage(significant).filter(ring => parcelGridPolygonArea(ring) >= 1e-6).map(ring => [ring]));
  if (!contourBuildingFootprint(result)) result = footprint(mergeConvexParcelGridCoverage(significant)
    .filter(ring => parcelGridPolygonArea(ring) >= 1e-6).map(ring => [ring]));
  if (Math.abs(area(result) - expected) > Math.max(.0001, expected * 1e-6))
    throw new Error("Die Gebäudeteilflächen konnten nicht lückenlos zusammengefügt werden.");
  if (!contourBuildingFootprint(result)) throw new Error("Die Dachteilbereiche enthalten ungültige Flächengrenzen.");
  return result;
}
function roofPlans(roof: ContourBuildingRoof): readonly Polygon[] {
  return roofSurfaceTriangles(roof.calculation).map(triangle => triangle.map(p => [p[0], p[2]] as Point))
    .filter(ring => parcelGridPolygonArea(ring) > 1e-8);
}

/** Existing metadata without partitions keeps its original component contract. */
export function contourBuildingScopes(metadata: ContourBuildingMetadata): readonly ContourBuildingScope[] {
  if (metadata.storeyPartitions) return metadata.storeyPartitions.map((partition, index) => ({...partition, index}))
    .filter(scope => scope.footprint.coordinates.length > 0);
  return metadata.footprint.coordinates.map((polygon, index) => {
    const roofs = metadata.source?.roofs.filter(roof => contourRoofComponentIndex(metadata, roof) === index) ?? [];
    return {index, id: `component:${index}`, footprint: footprint([polygon]), sourceComponentIndex: index,
      roofObjectIds: roofs.map(roof => roof.objectInstanceId), originalEavesY: roofs.length
        ? Math.max(...roofs.map(roof => roof.eavesY)) : metadata.source?.originalEavesY ?? metadata.baseY};
  });
}

/** Current generated roof IDs may change on every save. Exact projected overlap
 * is the fallback, while partition IDs and their order remain unchanged. */
export function contourRoofScopeIndex(metadata: ContourBuildingMetadata, roof: ContourBuildingRoof): number {
  if (!metadata.storeyPartitions) return contourRoofComponentIndex(metadata, roof);
  const scopes = contourBuildingScopes(metadata);
  const imported = roof.parameters.importedSource as Record<string, unknown> | undefined;
  const identified = scopes.find(scope => scope.id === imported?.storeyPartitionId);
  if (identified) return identified.index;
  const matching = scopes.filter(scope => scope.roofObjectIds.includes(roof.objectInstanceId));
  if (matching.length === 1) return matching[0]!.index;
  const plans = roofPlans(roof);
  let best = scopes[0]?.index ?? 0, bestArea = -1;
  for (const scope of matching.length ? matching : scopes) {
    const size = overlap(plans, triangles(scope.footprint));
    if (size > bestArea) { bestArea = size; best = scope.index; }
  }
  return best;
}

/** Disjoint connected roof domains, clipped to GroundSurface including holes.
 * Lower roofs consume overlapping projections first, matching body clipping. */
export function ensureContourBuildingPartitions(metadata: ContourBuildingMetadata): ContourBuildingMetadata {
  if (metadata.storeyPartitions || !metadata.source?.roofs.length) return metadata;
  const candidates = [...metadata.source.roofs].sort((a, b) => a.eavesY - b.eavesY || a.objectInstanceId.localeCompare(b.objectInstanceId))
    .map(roof => ({roof, plans: roofPlans(roof)}));
  if (candidates.reduce((sum, item) => sum + item.plans.length, 0) > 1000)
    throw new Error("Die Gebäudeteile überschreiten das sichere Bearbeitungslimit von 1.000 Dachdreiecken.");
  const partitions: ContourStoreyPartition[] = [];
  metadata.footprint.coordinates.forEach((polygon, componentIndex) => {
    const pieces = candidates.map(() => [] as Polygon[]);
    for (const triangle of triangles(footprint([polygon]))) {
      let remaining: readonly Polygon[] = [triangle];
      candidates.forEach((candidate, index) => { for (const plan of candidate.plans) {
        const next: Polygon[] = [];
        for (const piece of remaining) {
          const cut = intersectConvexParcelGridPolygons(piece, plan);
          if (parcelGridPolygonArea(cut) <= 1e-8) { next.push(piece); continue; }
          pieces[index]!.push(cut); next.push(...subtractConvexParcelGridPolygon(piece, plan));
        } remaining = next;
      }});
      // Ground surfaces can extend slightly beyond incomplete imported roofs.
      // Keep complete ground coverage, assigning the actual remaining triangles
      // to their nearest source domain rather than inventing rectangular fills.
      for (const piece of remaining) {
        const centre: Point = [piece.reduce((s, p) => s + p[0], 0) / piece.length, piece.reduce((s, p) => s + p[1], 0) / piece.length];
        let best = -1, bestDistance = Infinity;
        candidates.forEach((candidate, index) => { const d = Math.min(...candidate.plans.map(plan => distance(centre, plan)));
          if (d < bestDistance) { best = index; bestDistance = d; } });
        if (best < 0) throw new Error("Für die Gebäudegrundfläche fehlen gültige Dachbereiche.");
        pieces[best]!.push(piece);
      }
    }
    pieces.forEach((parts, index) => {
      if (!parts.length) return;
      const shape = merged(parts), candidate = candidates[index]!;
      // Keep one source roof domain per ground component. Its exact coverage
      // may contain multiple clipped polygons, all sharing the same floor profile.
      partitions.push({
        id: `lod2-region:${componentIndex}:${candidate.roof.objectInstanceId}`,
        footprint: shape, roofObjectIds: [candidate.roof.objectInstanceId],
        sourceComponentIndex: componentIndex, originalEavesY: candidate.roof.eavesY,
      });
    });
  });
  if (!partitions.length || partitions.length > 256) throw new Error("Keine sicher bearbeitbare Aufteilung der Gebäudeteile gefunden.");
  return {...metadata, storeyPartitions: partitions};
}

/** Retain partition IDs/order while adapting their true polygons to an edited
 * outer/courtyard ring. Removed regions remain inactive, so later indices never shift. */
export function refitContourBuildingPartitions(metadata: ContourBuildingMetadata,
  currentFootprint: ContourBuildingFootprint): readonly ContourStoreyPartition[] | undefined {
  if (!metadata.storeyPartitions) return undefined;
  if (JSON.stringify(metadata.footprint.coordinates) === JSON.stringify(currentFootprint.coordinates)) return metadata.storeyPartitions;
  const originalPoints = metadata.footprint.coordinates.flat(2), currentPoints = currentFootprint.coordinates.flat(2);
  if (originalPoints.length === currentPoints.length && originalPoints.length
    && metadata.footprint.coordinates.every((polygon, i) => polygon.length === currentFootprint.coordinates[i]?.length
      && polygon.every((ring, j) => ring.length === currentFootprint.coordinates[i]?.[j]?.length))) {
    const dx = currentPoints[0]![0] - originalPoints[0]![0], dz = currentPoints[0]![1] - originalPoints[0]![1];
    if (originalPoints.every((p, i) => Math.hypot(currentPoints[i]![0] - p[0] - dx, currentPoints[i]![1] - p[1] - dz) < 1e-7))
      return metadata.storeyPartitions.map(partition => ({...partition, footprint: footprint(partition.footprint.coordinates
        .map(polygon => polygon.map(ring => ring.map(p => [p[0] + dx, p[1] + dz] as Point))))}));
  }
  const candidates = metadata.storeyPartitions.map(scope => ({scope, plans: triangles(scope.footprint)}));
  const parts = candidates.map(() => [] as Polygon[]);
  const edges = candidates.flatMap((candidate, index) => candidate.scope.footprint.coordinates.flatMap(polygon => polygon.flatMap(ring =>
    ring.map((a, i) => ({a, b: ring[(i + 1) % ring.length]!, index})))));
  const seams = edges.filter(edge => edges.some(other => {
    if (edge.index === other.index) return false;
    const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1], length = Math.hypot(dx, dz);
    if (length < 1e-8) return false;
    const along = (p: Point) => ((p[0] - edge.a[0]) * dx + (p[1] - edge.a[1]) * dz) / length;
    return [other.a, other.b].every(p => Math.abs(dx * (p[1] - edge.a[1]) - dz * (p[0] - edge.a[0])) < length * 1e-6)
      && Math.min(length, Math.max(along(other.a), along(other.b))) - Math.max(0, Math.min(along(other.a), along(other.b))) > 1e-6;
  }));
  for (const triangle of triangles(currentFootprint)) {
    let remaining: readonly Polygon[] = [triangle];
    candidates.forEach((candidate, index) => { for (const plan of candidate.plans) {
      const next: Polygon[] = [];
      for (const piece of remaining) {
        const cut = intersectConvexParcelGridPolygons(piece, plan);
        if (parcelGridPolygonArea(cut) <= 1e-8) { next.push(piece); continue; }
        parts[index]!.push(cut); next.push(...subtractConvexParcelGridPolygon(piece, plan));
      } remaining = next;
    }});
    for (const seam of seams) {
      remaining = remaining.flatMap(piece => split(piece, seam.a, seam.b));
      if (remaining.length > 8192) throw new Error("Die Gebäudeteil-Ergänzung überschreitet das sichere Flächenlimit.");
    }
    for (const piece of remaining) {
      const centre: Point = [piece.reduce((s, p) => s + p[0], 0) / piece.length, piece.reduce((s, p) => s + p[1], 0) / piece.length];
      let best = -1, bestDistance = Infinity;
      candidates.forEach((candidate, index) => { const d = Math.min(...candidate.plans.map(plan => distance(centre, plan)));
        if (d < bestDistance) { best = index; bestDistance = d; } });
      if (best < 0) throw new Error("Die neue Grundfläche besitzt keinen zuordenbaren Gebäudeteil.");
      parts[best]!.push(piece);
    }
  }
  return candidates.map((candidate, index) => ({...candidate.scope, footprint: merged(parts[index]!)}));
}

/** Migrate old component-scoped heights once, without assigning one wing's
 * custom slab levels to another wing just because its displayed index changed. */
export function remapContourStoreyHeightProfile(profile: BuildingStoreyHeightProfile,
  previous: ContourBuildingMetadata, next: ContourBuildingMetadata): BuildingStoreyHeightProfile {
  const boundariesByScope: Record<string, readonly number[]> = {all: storeyScopeBoundaries(profile, "all")};
  const before = contourBuildingScopes(previous);
  for (const scope of contourBuildingScopes(next)) {
    const old = previous.storeyPartitions ? before.find(value => value.id === scope.id)
      : before.find(value => value.index === scope.sourceComponentIndex);
    const values = storeyScopeBoundaries(profile, old ? `segment:${old.index}` : "all");
    if (previous.storeyPartitions && old) boundariesByScope[`segment:${scope.index}`] = [...values];
    else {
      const top = scope.originalEavesY - next.baseY;
      boundariesByScope[`segment:${scope.index}`] = [...values.slice(0, -1).filter(value => value < top - 1e-8), top];
    }
  }
  return {...profile, boundariesByScope};
}

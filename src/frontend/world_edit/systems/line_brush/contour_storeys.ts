import { ShapeUtils, Vector2 } from "three";
import { roofSurfaceTriangles, type RoofTriangle } from "../../../scene/roof_surface_geometry";
import type { LineBrushBuildingBlockCell, LineBrushBuildingStoreyGeometry } from "./building_geometry";
import { reserveLineBrushBuildingCellBudget } from "./building_geometry";
import type { ContourBuildingFootprint } from "./contour_building";
import { buildLineBrushRoofWallCells, type LineBrushRoofWallCell, type LineBrushRoofWallZone } from "./roof_walls";
import { intersectConvexParcelGridPolygons, subtractConvexParcelGridPolygon, parcelGridPolygonArea } from "../parcel_grid/geometry";

type Point = readonly [number, number];
export interface ContourEavesZone {
  readonly calculation: unknown;
  readonly eavesY: number;
  /** Persistent ground domain, excluding neighbouring roof overhangs. */
  readonly footprint?: ContourBuildingFootprint;
}
export interface ContourRoofWallZone extends ContourEavesZone {
  readonly scope: string;
  readonly polygon: readonly (readonly Point[])[];
}
export const CONTOUR_ROOF_TRIANGLE_LIMIT = 1000;
const trianglesCache = new WeakMap<object, readonly RoofTriangle[]>();
interface Facet {
  readonly ring: readonly Point[];
  readonly triangle: RoofTriangle;
  readonly height: number;
  readonly zoneIndex: number;
  readonly order: number;
  readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number;
}

/** One immutable triangle table and local spatial index per operation. */
function table(zones: readonly ContourEavesZone[]) {
  const facets: Facet[] = [];
  let sourceTriangles = 0;
  zones.forEach((zone, zoneIndex) => {
    if (!Number.isFinite(zone.eavesY)) throw new Error("Ungültige Traufhöhe im Bestandsdach.");
    const key = zone.calculation && typeof zone.calculation === "object" ? zone.calculation as object : null;
    let triangles = key ? trianglesCache.get(key) : undefined;
    if (!triangles) { triangles = roofSurfaceTriangles(zone.calculation); if (key) trianglesCache.set(key, triangles); }
    const domain = zone.footprint?.coordinates.flatMap(polygon => {
      const points = polygon.flat();
      return ShapeUtils.triangulateShape(polygon[0]!.map(p => new Vector2(...p)), polygon.slice(1).map(ring => ring.map(p => new Vector2(...p))))
        .map(indices => indices.map(index => points[index]!));
    });
    for (const triangle of triangles) {
      const plan = triangle.map(p => [p[0], p[2]] as Point);
      if (parcelGridPolygonArea(plan) < 1e-8) continue;
      if (++sourceTriangles > CONTOUR_ROOF_TRIANGLE_LIMIT) throw new Error("Das Bestandsdach überschreitet das sichere Bearbeitungslimit von 1.000 Dreiecken.");
      const rings = domain ? domain.map(piece => intersectConvexParcelGridPolygons(plan, piece)).filter(ring => parcelGridPolygonArea(ring) > 1e-8) : [plan];
      for (const ring of rings) {
        if (facets.length >= 8192) throw new Error("Die Gebäudeteil-Dachgrenzen überschreiten das sichere Flächenlimit.");
        facets.push({ ring, triangle, height: zone.eavesY, zoneIndex, order: facets.length,
          x0: Math.min(...ring.map(p => p[0])), x1: Math.max(...ring.map(p => p[0])),
          z0: Math.min(...ring.map(p => p[1])), z1: Math.max(...ring.map(p => p[1])) });
      }
    }
  });
  // The first physical roof above a room bounds it; a higher overlapping
  // projection must not grow another wall through the lower annex roof.
  facets.sort((a, b) => a.height - b.height || a.zoneIndex - b.zoneIndex || a.order - b.order);
  const buckets = new Map<string, Facet[]>();
  for (const facet of facets) {
    const x0 = Math.floor(facet.x0 / 8), x1 = Math.floor(facet.x1 / 8), z0 = Math.floor(facet.z0 / 8), z1 = Math.floor(facet.z1 / 8);
    if (![x0, x1, z0, z1].every(Number.isSafeInteger) || (x1 - x0 + 1) * (z1 - z0 + 1) > 4096) throw new Error("Die Bestandsdachfläche ist zu groß für die Gebäudeoperation.");
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const key = `${x}:${z}`, list = buckets.get(key) ?? []; list.push(facet); buckets.set(key, list);
    }
  }
  const query = (polygon: readonly Point[]) => {
    const x0 = Math.min(...polygon.map(p => p[0])), x1 = Math.max(...polygon.map(p => p[0]));
    const z0 = Math.min(...polygon.map(p => p[1])), z1 = Math.max(...polygon.map(p => p[1]));
    const selected = new Set<Facet>();
    for (let x = Math.floor(x0 / 8); x <= Math.floor(x1 / 8); x++) for (let z = Math.floor(z0 / 8); z <= Math.floor(z1 / 8); z++)
      for (const facet of buckets.get(`${x}:${z}`) ?? []) if (!(x1 < facet.x0 || x0 > facet.x1 || z1 < facet.z0 || z0 > facet.z1)) selected.add(facet);
    return [...selected].sort((a, b) => a.height - b.height || a.zoneIndex - b.zoneIndex || a.order - b.order);
  };
  return { facets, query };
}

/** Keep the original eaves of lower annexes and the partial uppermost storey.
 * Every fragment retains its integer owner, so roofs, slabs and mining agree.
 */
export function contourStoreyClipper(zones: readonly ContourEavesZone[]) {
  const surfaces = table(zones);
  const planCache = new WeakMap<readonly Point[], readonly { polygon: Point[]; height: number }[]>();
  const partition = (polygon: readonly Point[]) => {
    const cached = planCache.get(polygon);
    if (cached) return cached;
    const parts: Array<{ polygon: Point[]; height: number }> = [];
    let remaining: readonly (readonly Point[])[] = [polygon];
    for (const facet of surfaces.query(polygon)) {
      if (!remaining.length) break;
      const next: Array<readonly Point[]> = [];
      for (const piece of remaining) {
        const cut = intersectConvexParcelGridPolygons(piece, facet.ring);
        if (parcelGridPolygonArea(cut) < 1e-8) { next.push(piece); continue; }
        parts.push({ polygon: [...cut], height: facet.height });
        next.push(...subtractConvexParcelGridPolygon(piece, facet.ring));
      }
      remaining = next;
    }
    planCache.set(polygon, parts);
    return parts;
  };
  function cells(input: readonly LineBrushBuildingBlockCell[]): LineBrushBuildingBlockCell[] {
    return input.flatMap(cell => {
      const lower = cell.minimumY ?? cell.y, upper = cell.maximumY ?? cell.y + 1;
      const polygons: Point[][] = [], maxima: number[][] = [];
      const footprints = cell.footprintPolygons ?? [[[cell.x, cell.z], [cell.x + 1, cell.z], [cell.x + 1, cell.z + 1], [cell.x, cell.z + 1]] as Point[]];
      for (const polygon of footprints) {
        // All floors share the same construction-plan polygons. Intersect the
        // roof domains once; only heights and owner cells vary between floors.
        for (const part of partition(polygon)) {
          const top = Math.min(upper, part.height);
          if (top > lower + 1e-7) { polygons.push(part.polygon); maxima.push(part.polygon.map(() => top)); }
        }
      }
      if (!polygons.length) return [];
      return [{ ...cell, footprintPolygons: polygons, maximumHeights: maxima,
        minimumHeights: polygons.map(polygon => polygon.map(() => lower)),
        minimumY: lower, maximumY: Math.max(...maxima.flat()) }];
    });
  }
  return (storey: LineBrushBuildingStoreyGeometry): LineBrushBuildingStoreyGeometry => {
    const wallCells = cells(storey.wallCells), slabCells = cells(storey.slabCells);
    return { ...storey, wallCells, slabCells, occupiedCells: [...wallCells, ...slabCells] };
  };
}

function planeHeight(triangle: RoofTriangle, point: Point): number {
  const [a, b, c] = triangle;
  const det = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
  const u = ((point[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (point[1] - a[2])) / det;
  const v = ((b[0] - a[0]) * (point[1] - a[2]) - (point[0] - a[0]) * (b[2] - a[2])) / det;
  return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
}
function open(ring: readonly Point[]): readonly Point[] {
  return ring.length > 1 && Math.hypot(ring[0]![0] - ring.at(-1)![0], ring[0]![1] - ring.at(-1)![1]) < 1e-8 ? ring.slice(0, -1) : ring;
}
function shared(a: Point, b: Point, c: Point, d: Point): boolean {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length < 1e-8) return false;
  const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
  const along = (p: Point) => dx * (p[0] - a[0]) + dz * (p[1] - a[1]);
  return [c, d].every(p => Math.abs(dx * (p[1] - a[1]) - dz * (p[0] - a[0])) < 1e-5)
    && Math.min(length, Math.max(along(c), along(d))) - Math.max(0, Math.min(along(c), along(d))) > 1e-6;
}

/** Roof geometry stays on its original footprint; walls follow GroundSurface
 * exterior/courtyard edges and the true junctions between stepped roofs. */
export function contourRoofWallCells(footprint: ContourBuildingFootprint,
  zones: readonly ContourRoofWallZone[]): readonly LineBrushRoofWallCell[] {
  const surfaces = table(zones);
  const exclusive = zones.map(() => [] as Array<{ polygon_3d_mm: number[][] }>);
  for (const facet of surfaces.facets) {
    let pieces: readonly (readonly Point[])[] = [facet.ring];
    for (const earlier of surfaces.query(facet.ring)) {
      if (earlier === facet) break;
      pieces = pieces.flatMap(piece => subtractConvexParcelGridPolygon(piece, earlier.ring));
      if (!pieces.length) break;
    }
    for (const piece of pieces) exclusive[facet.zoneIndex]!.push({ polygon_3d_mm: piece.map(p => [p[0] * 1000, p[1] * 1000, planeHeight(facet.triangle, p) * 1000]) });
  }
  const outerZones: LineBrushRoofWallZone[] = [], ownerIndices: number[] = [];
  for (const [index, zone] of zones.entries()) for (const polygon of footprint.coordinates) {
    outerZones.push({ ...zone, polygon, interiorEdges: [], calculation: { geometry: { faces: exclusive[index] } } });
    ownerIndices.push(index);
  }
  const exterior = buildLineBrushRoofWallCells(outerZones).map(cell => ({ ...cell,
    logicalCellId: `contour-exterior:${cell.logicalCellId}`, roofZoneIndex: ownerIndices[cell.roofZoneIndex]! }));
  const internalParts = zones.flatMap((zone, ownerIndex) => (zone.footprint?.coordinates ?? [zone.polygon])
    .map(polygon => ({zone, ownerIndex, polygon})));
  const internalZones = internalParts.map(({zone, polygon}, index): LineBrushRoofWallZone => {
    const ring = open(polygon[0] ?? []);
    const interiorEdges = ring.flatMap((a, edge) => internalParts.some(({zone: otherZone, polygon: other}, otherIndex) => {
      if (index === otherIndex || zone.footprint && otherZone.footprint && zone.scope === otherZone.scope) return false;
      const neighbour = open(other[0] ?? []);
      return neighbour.some((c, next) => shared(a, ring[(edge + 1) % ring.length]!, c, neighbour[(next + 1) % neighbour.length]!));
    }) ? [edge] : []);
    return { ...zone, polygon, interiorEdges, exteriorEdges: [], includeCourtyardWalls: false, internalWallFromAdjacentRoof: true };
  });
  const groundTriangles = footprint.coordinates.flatMap(polygon => {
    const rings = polygon.map(open), vertices = rings.flat();
    return ShapeUtils.triangulateShape(rings[0]!.map(p => new Vector2(...p)), rings.slice(1).map(ring => ring.map(p => new Vector2(...p))))
      .map(indices => indices.map(index => vertices[index]!));
  });
  const internal = buildLineBrushRoofWallCells(internalZones).flatMap(cell => {
    const polygons: Point[][] = [], minima: number[][] = [], maxima: number[][] = [];
    cell.footprintPolygons?.forEach((polygon, polygonIndex) => {
      // Roof wall fragments are convex with planar corner heights.
      let widest: readonly [number, number, number] = [0, 1, 2], area = 0;
      for (let i = 1; i + 1 < polygon.length; i++) {
        const next = parcelGridPolygonArea([polygon[0]!, polygon[i]!, polygon[i + 1]!]);
        if (next > area) { area = next; widest = [0, i, i + 1]; }
      }
      if (area < 1e-10) return;
      const top = widest.map(index => [polygon[index]![0], cell.maximumHeights![polygonIndex]![index]!, polygon[index]![1]] as const) as unknown as RoofTriangle;
      const bottom = widest.map(index => [polygon[index]![0], cell.minimumHeights![polygonIndex]![index]!, polygon[index]![1]] as const) as unknown as RoofTriangle;
      for (const triangle of groundTriangles) {
        const cut = intersectConvexParcelGridPolygons(polygon, triangle);
        if (parcelGridPolygonArea(cut) < 1e-8) continue;
        polygons.push([...cut]); minima.push(cut.map(p => planeHeight(bottom, p))); maxima.push(cut.map(p => planeHeight(top, p)));
      }
    });
    return polygons.length ? [{ ...cell, roofZoneIndex: internalParts[cell.roofZoneIndex]!.ownerIndex,
      logicalCellId: `contour-step:${cell.logicalCellId}`,
      footprintPolygons: polygons, minimumHeights: minima, maximumHeights: maxima }] : [];
  });
  reserveLineBrushBuildingCellBudget(exterior.length, internal.length);
  return [...exterior, ...internal];
}

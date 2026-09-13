import { ShapeUtils, Vector2 } from "three";
import { unionPathBrushPlanPolygons } from "../shared/path_brush_geometry";
import { intersectConvexParcelGridPolygons, subtractConvexParcelGridPolygon, parcelGridPolygonArea } from "../parcel_grid/geometry";
import { contourBuildingFootprint, contourBuildingStandardHeight, translateContourRoofCalculation,
  type ContourBuildingMetadata, type ContourBuildingFootprint, type ContourBuildingRoof } from "./contour_building";
import { contourBuildingScopes, contourRoofScopeIndex, refitContourBuildingPartitions } from "./contour_partitions";

type Point = readonly [number, number];
type Vertex = readonly [number, number, number];
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
interface Facet { readonly points: readonly Vertex[]; readonly plan: readonly Point[]; readonly roof: ContourBuildingRoof }
function triangulate(polygon: ContourBuildingFootprint["coordinates"][number]): readonly (readonly Point[])[] {
  const vertices = polygon.flat();
  return ShapeUtils.triangulateShape(polygon[0]!.map(p => new Vector2(...p)),
    polygon.slice(1).map(ring => ring.map(p => new Vector2(...p))))
    .map(indices => indices.map(index => vertices[index]!));
}
function height(facet: Facet, p: Point): number {
  const [a, b, c] = facet.points;
  const denominator = (b![0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (b![1] - a![1]);
  const u = ((p[0] - a![0]) * (c![1] - a![1]) - (c![0] - a![0]) * (p[1] - a![1])) / denominator;
  const v = ((b![0] - a![0]) * (p[1] - a![1]) - (p[0] - a![0]) * (b![1] - a![1])) / denominator;
  return a![2] + u * (b![2] - a![2]) + v * (c![2] - a![2]);
}
function distance(point: Point, triangle: readonly Point[]): number {
  const cross = (a: Point, b: Point) => (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]);
  const signs = triangle.map((a, i) => cross(a, triangle[(i + 1) % triangle.length]!));
  if (signs.every(value => value >= -1e-8) || signs.every(value => value <= 1e-8)) return 0;
  return Math.min(...triangle.map((a, index) => {
    const b = triangle[(index + 1) % triangle.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / (dx * dx + dz * dz)));
    return (point[0] - a[0] - dx * t) ** 2 + (point[1] - a[1] - dz * t) ** 2;
  }));
}
function splitAtCrease(polygon: readonly Point[], a: Point, b: Point): readonly (readonly Point[])[] {
  const side = (p: Point) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (!polygon.some(p => side(p) > 1e-8) || !polygon.some(p => side(p) < -1e-8)) return [polygon];
  return [1, -1].map(sign => {
    const result: Point[] = [];
    polygon.forEach((p, index) => {
      const q = polygon[(index + 1) % polygon.length]!, first = sign * side(p), next = sign * side(q);
      if (first >= -1e-8) result.push(p);
      if (first * next < -1e-16) { const t = first / (first - next); result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    });
    return result;
  }).filter(piece => parcelGridPolygonArea(piece) > 1e-8);
}
function movedParameters(roof: ContourBuildingRoof, deltaY: number, deltaX = 0, deltaZ = 0): Readonly<Record<string, unknown>> {
  const source = record(roof.parameters.importedSource);
  const shiftPlan = (value: unknown): unknown => Array.isArray(value)
    ? value.length === 2 && value.every(Number.isFinite) ? [value[0] + deltaX, value[1] + deltaZ] : value.map(shiftPlan) : value;
  const facadeSegments = Array.isArray(source.facadeSegments) ? source.facadeSegments.map(value => {
    const edge = record(value);
    return { ...edge, start: shiftPlan(edge.start), end: shiftPlan(edge.end), maximumY: Number(edge.maximumY) + deltaY,
      ...(Array.isArray(edge.topProfile) ? { topProfile: edge.topProfile.map(p => Array.isArray(p) ? [p[0], Number(p[1]) + deltaY] : p) } : {}) };
  }) : [];
  // Source facets/baseY stay the reference for later relative slope/eaves edits.
  const nextSource = { ...clone(source), facadeSegments } as Record<string, unknown>;
  if (deltaX || deltaZ) {
    nextSource.footprint = shiftPlan(source.footprint);
    nextSource.groundFootprints = shiftPlan(source.groundFootprints);
    if (Array.isArray(source.faces)) nextSource.faces = source.faces.map(value => {
      const face = record(value);
      return { ...face, polygon_3d_mm: Array.isArray(face.polygon_3d_mm) ? face.polygon_3d_mm.map(p =>
        Array.isArray(p) ? [Number(p[0]) + deltaX * 1000, Number(p[1]) + deltaZ * 1000, p[2]] : p) : face.polygon_3d_mm };
    });
    delete nextSource.constructionGrid; // derive from the translated GroundSurface/facades
  }
  return { ...clone(roof.parameters), eavesHeightMm: (roof.eavesY + deltaY) * 1000,
    ...(Object.keys(source).length ? { importedSource: nextSource } : {}) };
}

function footprintTranslation(original: ContourBuildingFootprint, current: ContourBuildingFootprint): Point | null {
  if (original.coordinates.length !== current.coordinates.length) return null;
  const a = original.coordinates[0]![0]![0]!, b = current.coordinates[0]![0]![0]!;
  const delta: Point = [b[0] - a[0], b[1] - a[1]];
  for (const [i, polygon] of original.coordinates.entries()) {
    if (polygon.length !== current.coordinates[i]!.length) return null;
    for (const [j, ring] of polygon.entries()) {
      const next = current.coordinates[i]![j]!;
      if (ring.length !== next.length || ring.some((p, k) => Math.hypot(p[0] + delta[0] - next[k]![0], p[1] + delta[1] - next[k]![1]) > 1e-7)) return null;
    }
  }
  return delta;
}

/** Use an actual roof-face interior, never a bounding-box centre in a courtyard. */
export function contourRoofComponentIndex(metadata: ContourBuildingMetadata, roof: ContourBuildingRoof): number {
  const polygons = metadata.source?.originalFootprint.coordinates ?? metadata.footprint.coordinates;
  const contains = (point: Point, ring: readonly Point[]): boolean => {
    let result = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]!, b = ring[j]!;
      if ((a[1] > point[1]) !== (b[1] > point[1])
        && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  };
  const faces = record(roof.calculation.geometry).faces;
  for (const face of Array.isArray(faces) ? faces : []) {
    const points = record(face).polygon_3d_mm;
    if (!Array.isArray(points) || !points.length) continue;
    const center = points.reduce((sum, p) => Array.isArray(p)
      ? [sum[0] + Number(p[0]) / points.length / 1000, sum[1] + Number(p[1]) / points.length / 1000] : sum, [0, 0]) as Point;
    const index = polygons.findIndex(polygon => contains(center, polygon[0]!) && !polygon.slice(1).some(ring => contains(center, ring)));
    if (index >= 0) return index;
  }
  // A narrow eaves facet may be outside the GroundSurface. Select the component
  // with the largest real roof-footprint intersection instead of inventing a point.
  const roofFootprint = contourBuildingFootprint(roof.footprint);
  let best = 0, bestArea = 0;
  const roofTriangles = roofFootprint?.coordinates.flatMap(triangulate) ?? [];
  polygons.forEach((polygon, index) => {
    const overlap = triangulate(polygon).reduce((sum, triangle) => sum + roofTriangles.reduce((value, other) =>
      value + parcelGridPolygonArea(intersectConvexParcelGridPolygons(triangle, other)), 0), 0);
    if (overlap > bestArea) { bestArea = overlap; best = index; }
  });
  return best;
}

/** Keep exact source roofs for a height edit. A contour edit clips existing
 * facets exactly and extends only the newly added area from nearby roof planes.
 * Earcut operates on every real outer/hole ring; no rectangle covers a courtyard. */
export function contourBuildingRoofs(metadata: ContourBuildingMetadata, currentFootprint: ContourBuildingFootprint,
  deltaStoreys: number, componentDeltas: Readonly<Record<string, number>> = {},
  scopeHeightDeltasMeters: Readonly<Record<string, number>> = {}): readonly ContourBuildingRoof[] {
  if (!Number.isInteger(deltaStoreys) || !metadata.source?.roofs.length) return [];
  const footprint = contourBuildingFootprint(currentFootprint);
  if (!footprint) throw new Error("Der neue Gebäudeumriss ist ungültig.");
  const countDelta = (index: number): number => {
    const value = componentDeltas[String(index)] ?? componentDeltas[`segment:${index}`] ?? 0;
    if (!Number.isInteger(value)) throw new Error("Ungültige Geschossänderung für einen Gebäudeteil.");
    return deltaStoreys + value;
  };
  const standard = contourBuildingStandardHeight(metadata);
  const heightDelta = (index: number): number => {
    const value = scopeHeightDeltasMeters[String(index)] ?? scopeHeightDeltasMeters[`segment:${index}`]
      ?? scopeHeightDeltasMeters.all ?? countDelta(index) * standard;
    if (!Number.isFinite(value)) throw new Error("Ungültiger Höhenversatz für einen Gebäudeteil.");
    return value;
  };
  const translation = footprintTranslation(metadata.source.originalFootprint, footprint);
  if (translation) return metadata.source.roofs.map(roof => {
    const index = contourRoofScopeIndex(metadata, roof), change = countDelta(index), deltaY = heightDelta(index);
    const [deltaX, deltaZ] = translation;
    const sourceFootprint = contourBuildingFootprint(roof.footprint);
    const coordinates = sourceFootprint?.coordinates[0]?.map(ring => [...ring, ring[0]!].map(p => [p[0] + deltaX, p[1] + deltaZ]));
    return ({
    ...clone(roof), anchor: { x: Math.floor(coordinates ? Math.min(...coordinates[0]!.map(p => p[0]!)) : roof.anchor.x + deltaX),
      y: Math.floor(roof.eavesY + deltaY), z: Math.floor(coordinates ? Math.min(...coordinates[0]!.map(p => p[1]!)) : roof.anchor.z + deltaZ) },
    eavesY: roof.eavesY + deltaY, storeyCount: Math.max(1, roof.storeyCount + change),
    footprint: { ...clone(roof.footprint), ...(coordinates ? { coordinates } : {}), baseY: Number(roof.footprint.baseY ?? roof.eavesY) + deltaY },
    parameters: movedParameters(roof, deltaY, deltaX, deltaZ), calculation: translateContourRoofCalculation(roof.calculation, deltaY, deltaX, deltaZ),
  }); });

  const facets: Facet[] = [];
  for (const roof of [...metadata.source.roofs].sort((a, b) => a.eavesY - b.eavesY)) {
    const faces = record(roof.calculation.geometry).faces;
    for (const raw of Array.isArray(faces) ? faces : []) {
      const polygon = record(raw).polygon_3d_mm;
      if (!Array.isArray(polygon) || polygon.length < 3 || !polygon.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) continue;
      const points = polygon.map(p => p.map((v: number) => v / 1000) as unknown as Vertex);
      const plan = points.map(p => [p[0], p[1]] as Point);
      const triangles = ShapeUtils.triangulateShape(plan.map(p => new Vector2(...p)), []);
      for (const indices of triangles) {
        const triangle = indices.map(index => points[index]!);
        const projected = triangle.map(p => [p[0], p[1]] as Point);
        if (parcelGridPolygonArea(projected) > 1e-8) facets.push({ points: triangle, plan: projected, roof });
      }
    }
  }
  if (!facets.length || facets.length > 8192) throw new Error("Die bestehenden Dachflächen konnten nicht sicher übernommen werden.");
  const edgeFacets = new Map<string, { facet: Facet; a: Point; b: Point }>();
  const creases: Array<readonly [Point, Point]> = [];
  for (const facet of facets) facet.plan.forEach((a, index) => {
    const b = facet.plan[(index + 1) % facet.plan.length]!;
    const key = [a, b].map(point => point.map(value => value.toFixed(4)).join(":")).sort().join("|");
    const previous = edgeFacets.get(key);
    if (!previous) { edgeFacets.set(key, { facet, a, b }); return; }
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const probe: Point = [(a[0] + b[0]) / 2 - (b[1] - a[1]) / length, (a[1] + b[1]) / 2 + (b[0] - a[0]) / length];
    if (Math.abs(height(previous.facet, probe) - height(facet, probe)) > 1e-5) creases.push([a, b]);
  });
  let faceCount = 0;
  const scopedMetadata = metadata.storeyPartitions ? {...metadata, footprint,
    storeyPartitions: refitContourBuildingPartitions(metadata, footprint)} : {...metadata, footprint};
  const targets = metadata.storeyPartitions ? contourBuildingScopes(scopedMetadata).flatMap(scope => scope.footprint.coordinates
    .map(polygon => ({polygon, scopeIndex: scope.index, partitionId: scope.id})))
    : footprint.coordinates.map((polygon, scopeIndex) => ({polygon, scopeIndex, partitionId: undefined}));
  return targets.flatMap(({polygon, scopeIndex, partitionId}, polygonIndex) => {
    const deltaY = heightDelta(scopeIndex);
    const faces: Array<{ face_ref: string; polygon_3d_mm: number[][] }> = [];
    const faceOwners = new Map<string, ContourBuildingRoof>();
    const append = (points: readonly Point[], evaluate: (point: Point) => number, owner: ContourBuildingRoof) => {
      if (parcelGridPolygonArea(points) < 1e-8) return;
      for (let i = 1; i + 1 < points.length; i++) {
        if (++faceCount > 8192) throw new Error("Der angepasste Dachumriss überschreitet das Flächenlimit.");
        const faceRef = `contour-${polygonIndex}-${faces.length}`;
        faceOwners.set(faceRef, owner);
        faces.push({ face_ref: faceRef, polygon_3d_mm: [points[0]!, points[i]!, points[i + 1]!]
          .map(p => [p[0] * 1000, p[1] * 1000, (evaluate(p) + deltaY) * 1000]) });
      }
    };
    const sample = (point: Point): number => {
      const nearest = facets.reduce((best, facet) => distance(point, facet.plan) < distance(point, best.plan) - 1e-10 ? facet : best, facets[0]!);
      return height(nearest, point);
    };
    for (const triangle of triangulate(polygon)) {
      let remaining: readonly (readonly Point[])[] = [triangle];
      for (const facet of facets) {
        if (!remaining.length) break;
        const next: Array<readonly Point[]> = [];
        for (const piece of remaining) {
          const intersection = intersectConvexParcelGridPolygons(piece, facet.plan);
          if (parcelGridPolygonArea(intersection) <= 1e-8) { next.push(piece); continue; }
          append(intersection, point => height(facet, point), facet.roof);
          next.push(...subtractConvexParcelGridPolygon(piece, facet.plan));
        }
        remaining = next;
      }
      // Continue actual ridges/valleys into additions. Without these cuts one
      // large new triangle could bridge over an unchanged gable ridge.
      for (const crease of creases) {
        remaining = remaining.flatMap(piece => splitAtCrease(piece, crease[0], crease[1]));
        if (remaining.length > 8192) throw new Error("Die Dachergänzung überschreitet das Flächenlimit.");
      }
      for (const piece of remaining) {
        const center: Point = [piece.reduce((sum,p)=>sum+p[0],0)/piece.length,piece.reduce((sum,p)=>sum+p[1],0)/piece.length];
        const nearest = facets.reduce((best,facet)=>distance(center,facet.plan)<distance(center,best.plan)?facet:best,facets[0]!);
        append(piece, sample, nearest.roof);
      }
    }
    if (!faces.length) throw new Error("Der neue Grundriss enthält keine gültige Dachfläche.");
    const createResult = (faces: Array<{face_ref:string;polygon_3d_mm:number[][]}>,
      polygon: ContourBuildingFootprint["coordinates"][number], first: ContourBuildingRoof, suffix: string): ContourBuildingRoof => {
    const heights = faces.flatMap(face => face.polygon_3d_mm.map(p => p[2]! / 1000));
    const eavesY = Math.min(...heights), maximumY = Math.max(...heights);
    const oldSource = record(first.parameters.importedSource);
    const closed = polygon.map(ring => [...ring, ring[0]!].map(point => [...point]));
    const source = { ...clone(oldSource), schemaVersion: "lod2-roof-source.v1", buildingId: metadata.source!.buildingId,
      footprint: closed, groundFootprints: footprint.coordinates, faces, baseY: eavesY,
      ...(partitionId ? {storeyPartitionId: partitionId} : {}),
      referencePitchDeg: maximumY - eavesY > 1e-6 ? 35 : 0,
      // New contours use the common construction grid; old facade axes must
      // never remesh an unrelated building edge after an outline edit.
      facadeSegments: [], constructionGrid: undefined };
    const hash = JSON.stringify(faces).split("").reduce((value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const id = `${first.objectInstanceId}:contour:${polygonIndex}${suffix}`;
    const fingerprint = `${id}:${hash.toString(16)}`;
    return { ...(first.facadeSource ? {facadeSource: first.facadeSource} : {}), objectInstanceId: id, anchor: { x: Math.floor(Math.min(...polygon[0]!.map(p => p[0]))), y: Math.floor(eavesY),
      z: Math.floor(Math.min(...polygon[0]!.map(p => p[1]))) }, eavesY,
      storeyCount: Math.max(1, Math.ceil((eavesY - metadata.baseY - 1e-6) / standard)),
      footprint: { ...clone(first.footprint), type: "Polygon", coordinates: closed, baseY: eavesY, height: Math.max(.1, maximumY - eavesY) },
      parameters: { ...clone(first.parameters), roofType: "imported", eavesHeightMm: eavesY * 1000,
        pitchDeg: source.referencePitchDeg, overhangMm: 0, importedSource: source },
      calculation: { ok: true, contract_version: "cad-roof-calculation-result/0.1", roof_type: "imported",
        calculation_id: fingerprint, input_fingerprint: fingerprint, source: "lod2-contour-adaptation",
        geometry: { faces }, structure: { rafters: [], purlins: [], source: "not-provided-by-lod2" },
        summary: { face_count: faces.length, maximum_height_mm: maximumY * 1000 } } };
    };
    const first = metadata.source!.roofs.find(roof => contourRoofScopeIndex(metadata, roof) === scopeIndex) ?? metadata.source!.roofs[0]!;
    if (!metadata.source!.roofs.some(roof => roof.facadeSource)) return [createResult(faces, polygon, first, "")];
    // A deleted roof remains a facade reference after a contour edit; its
    // triangles must never merge into the visible roof of a neighbouring wing.
    const groups = new Map<string, {owner:ContourBuildingRoof;faces:typeof faces}>();
    for (const face of faces) {
      const owner=faceOwners.get(face.face_ref)!, key=owner.facadeSource ? owner.objectInstanceId : "visible";
      const group=groups.get(key)??{owner,faces:[]};group.faces.push(face);groups.set(key,group);
    }
    const inside=(p:Point,ring:readonly Point[]):boolean=>{
      let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const a=ring[i]!,b=ring[j]!;
        if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
      }return yes;
    };
    return [...groups.values()].flatMap((group,groupIndex)=>{
      const polygons=unionPathBrushPlanPolygons(group.faces.map(face=>face.polygon_3d_mm.map(p=>[p[0]!/1000,p[1]!/1000] as Point)));
      return polygons.map((shape,index)=>{
        const selected=group.faces.filter(face=>{
          const p:Point=[face.polygon_3d_mm.reduce((sum,p)=>sum+p[0]!,0)/3000,face.polygon_3d_mm.reduce((sum,p)=>sum+p[1]!,0)/3000];
          return inside(p,shape[0]!) && !shape.slice(1).some(hole=>inside(p,hole));
        });
        return createResult(selected,shape,group.owner,`:source:${groupIndex}:${index}`);
      });
    });
  });
}

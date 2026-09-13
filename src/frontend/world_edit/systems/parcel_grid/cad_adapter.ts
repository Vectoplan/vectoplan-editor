/** CAD consumes the existing WorldEdit partition and building reference math.
 * No controller state or separate building-axis algorithm is introduced here.
 */
import { ShapeUtils, Vector2 } from "three";
import { buildParcelGridPartition, intersectConvexParcelGridPolygons, mergeParcelGridCoverage,
  normalizeParcelGridPolygon, parcelGridPolygonArea, resolveParcelGridRenderBounds,
  type ParcelGridPoint, type ParcelGridBoundarySegmentInput } from "./geometry";
import { lod2BuildingGridReferencesFromChunks, lod2BuildingFacadeBands, type Lod2BuildingFacadeDepth } from "./building_reference";
export { snapParcelGridDragDepth, parcelGridGuideIdentity, resolveParcelGridMaximumDepth } from "./geometry";

type Point = ParcelGridPoint;
export interface CadParcelGridInput {
  readonly parcels: readonly { readonly parcelId: string; readonly rings: readonly (readonly Point[])[] }[];
  readonly boundarySegments: readonly ParcelGridBoundarySegmentInput[];
  readonly objectRefs: readonly unknown[];
  readonly facadeDepths?: readonly Lod2BuildingFacadeDepth[];
  readonly visiblePoints: readonly Point[];
}
function triangulate(rings: readonly (readonly Point[])[]): readonly (readonly Point[])[] {
  const contours = rings.map(r=>normalizeParcelGridPolygon(r).map(p=>new Vector2(p[0],p[1]))).filter(r=>r.length>=3);
  if(!contours.length) return [];
  const vertices=contours.flat();
  return ShapeUtils.triangulateShape(contours[0]!,contours.slice(1)).map((face:number[])=>face.map(i=>[vertices[i]!.x,vertices[i]!.y] as Point))
    .filter((triangle:readonly Point[])=>parcelGridPolygonArea(triangle)>1e-8);
}
export function buildCadParcelGrid(input: CadParcelGridInput) {
  const points=input.parcels.flatMap(p=>p.rings.flat());
  const bounds=resolveParcelGridRenderBounds({points,visibleSurfacePoints:input.visiblePoints,fullRenderCellLimit:20000,visibleMarginCells:2});
  if(!bounds || bounds.renderedCells>60000) return {status:"zoom-required",cells:[],reference:null};
  const coverage=input.parcels.flatMap(p=>triangulate(p.rings));
  const candidates=lod2BuildingGridReferencesFromChunks([{objectRefs:input.objectRefs}]).map(reference=>{
    const triangles=reference.footprints.flatMap(p=>triangulate([p.outer,...p.holes]));
    const fragments=triangles.flatMap(t=>coverage.map(c=>intersectConvexParcelGridPolygons(t,c))).filter(p=>parcelGridPolygonArea(p)>1e-6);
    const overlap=mergeParcelGridCoverage(fragments).reduce((sum,p)=>sum+parcelGridPolygonArea(p),0);
    return {reference,triangles,overlap};
  }).filter(c=>c.overlap>.05).sort((a,b)=>b.overlap-a.overlap||b.reference.areaM2-a.reference.areaM2||a.reference.buildingId.localeCompare(b.reference.buildingId));
  const reference=candidates[0]?.reference ?? null;
  const facadeGuides=candidates.flatMap(c=>lod2BuildingFacadeBands(c.reference,1,input.facadeDepths));
  const partition=buildParcelGridPartition({
    boundarySegments:[...input.boundarySegments,...facadeGuides],
    coverageTriangles:coverage,excludedTriangles:candidates.flatMap(c=>c.triangles),bounds,
    regularGrid:reference?{id:reference.buildingId,origin:reference.origin,axisU:reference.axisU,axisV:reference.axisV,
      stepU:reference.stepU,stepV:reference.stepV,uAnchors:reference.uAnchors,vAnchors:reference.vAnchors}:null,minimumArea:1e-6,
  });
  return {status:"ready",facadeGuides,cells:partition.cells.map(c=>({polygon:c.polygon,zone:c.zone,boundaryKind:c.boundaryKind})),
    reference:reference?{buildingId:reference.buildingId,source:reference.referenceSource,origin:reference.origin,
      axisU:reference.axisU,axisV:reference.axisV,stepU:reference.stepU,stepV:reference.stepV}:null,
    coveredArea:partition.coveredArea,blockedArea:partition.blockedArea};
}

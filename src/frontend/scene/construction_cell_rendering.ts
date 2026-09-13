import * as THREE from "three";
import type { LineBrushBuildingBlockCell } from "../world_edit/systems/line_brush/building_geometry";

import { appendPrismFace, exposedPrismTriangles, type PrismPoint } from "./prism_surface_faces";

type Cell = LineBrushBuildingBlockCell;
type Range = { firstTriangle: number; endTriangle: number; cell: Cell };
export function constructionCellKey(cell: Cell): string {
  // Several variable-height storeys can share one integer address. Distinguish
  // their exact vertical fragments while deduplicating identical preview cells.
  return (cell.logicalCellId ? `${cell.logicalCellId}:${cell.y}` : `${cell.x}:${cell.y}:${cell.z}`)
    + (cell.minimumY === undefined ? "" : `:${cell.minimumY}:${cell.maximumY}`);
}

export function constructionCellMaterialGroups(cells: readonly Cell[], defaultBlockTypeId: string, existingLod2 = false): ReadonlyMap<string, readonly Cell[]> {
  const groups = new Map<string, Cell[]>();
  for (const cell of cells) {
    const key = existingLod2 ? "lod2_exterior_wall" : cell.materialBlockTypeId || defaultBlockTypeId;
    const group = groups.get(key) ?? [];
    group.push(cell);
    groups.set(key, group);
  }
  return groups;
}

/** Draw actual partition prisms; integer positions remain editable storage addresses. */
export function createConstructionCellMesh(
  cells: readonly Cell[], material: THREE.Material, scale = 1,
): THREE.Mesh | null {
  const unique = [...new Map(cells.map((cell) => [constructionCellKey(cell), cell])).values()];
  const facePositions: number[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  const ranges: Range[] = [], originalRanges: Range[] = [];
  const triangle = (offset: number) => {
    const ax = facePositions[offset]!, ay = facePositions[offset + 1]!, az = facePositions[offset + 2]!;
    const ux = facePositions[offset + 3]! - ax, uy = facePositions[offset + 4]! - ay, uz = facePositions[offset + 5]! - az;
    const vx = facePositions[offset + 6]! - ax, vy = facePositions[offset + 7]! - ay, vz = facePositions[offset + 8]! - az;
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    const horizontal = ny >= Math.max(nx, nz), uAxis = horizontal ? 0 : nx > nz ? 2 : 0, vAxis = horizontal ? 2 : 1;
    for (let vertex = offset; vertex < offset + 9; vertex += 3) {
      positions.push(facePositions[vertex]! * scale, facePositions[vertex + 1]! * scale, facePositions[vertex + 2]! * scale);
      uvs.push(facePositions[vertex + uAxis]! * scale, facePositions[vertex + vAxis]! * scale);
    }
  };
  for (const cell of unique) {
    const firstTriangle = facePositions.length / 9;
    const bottom = cell.minimumY ?? cell.y;
    const top = cell.maximumY ?? cell.y + 1;
    for (const [polygonIndex, raw] of (cell.footprintPolygons ?? [[[cell.x, cell.z], [cell.x + 1, cell.z], [cell.x + 1, cell.z + 1], [cell.x, cell.z + 1]]]).entries()) {
      const ring = raw.map((point, index) => ({ point,
        bottom: cell.minimumHeights?.[polygonIndex]?.[index] ?? bottom,
        top: cell.maximumHeights?.[polygonIndex]?.[index] ?? top }));
      if (ring.length > 1 && Math.hypot(ring[0]!.point[0] - ring.at(-1)!.point[0], ring[0]!.point[1] - ring.at(-1)!.point[1]) < 1e-8) ring.pop();
      if (ring.length < 3) continue;
      const signed = ring.reduce((sum, vertex, i) => { const p = vertex.point, q = ring[(i + 1) % ring.length]!.point; return sum + p[0] * q[1] - q[0] * p[1]; }, 0);
      if (signed < 0) ring.reverse();
      const at = (i: number, side: "top" | "bottom"): PrismPoint => [ring[i]!.point[0], ring[i]![side], ring[i]!.point[1]];
      appendPrismFace(ring.map((_, index) => at(index, "top")).reverse(), facePositions);
      appendPrismFace(ring.map((_, index) => at(index, "bottom")), facePositions);
      for (let i = 0; i < ring.length; i += 1) {
        const j = (i + 1) % ring.length;
        appendPrismFace([at(i, "bottom"), at(i, "top"), at(j, "top"), at(j, "bottom")], facePositions);
      }
    }
    originalRanges.push({ firstTriangle, endTriangle: facePositions.length / 9, cell });
  }
  const exposed = exposedPrismTriangles(facePositions);
  let ownerIndex = 0;
  for (const offset of exposed.offsets) {
    while (originalRanges[ownerIndex]!.endTriangle <= offset / 9) ownerIndex++;
    const cell = originalRanges[ownerIndex]!.cell;
    const firstTriangle = positions.length / 9;
    triangle(offset);
    const previous = ranges.at(-1);
    if (previous?.cell === cell) previous.endTriangle = positions.length / 9;
    else ranges.push({ firstTriangle, endTriangle: positions.length / 9, cell });
  }
  if (!positions.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.constructionCellRanges = ranges;
  mesh.userData.constructionCellCount = unique.length;
  mesh.userData.removedInteriorTriangleCount = exposed.removedTriangleCount;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function constructionCellForIntersection(hit: THREE.Intersection): Cell | null {
  if (hit.faceIndex === undefined || hit.faceIndex === null) return null;
  const ranges = hit.object.userData.constructionCellRanges as readonly Range[] | undefined;
  return ranges?.find((range) => hit.faceIndex! >= range.firstTriangle && hit.faceIndex! < range.endTriangle)?.cell ?? null;
}

/** Storeys/slabs are separate editable objects, but their touching surfaces
 * belong to one solid building. Cull their interfaces without merging IDs. */
export function removeConstructionMeshInterfaces(meshes: readonly THREE.Mesh[]): number {
  const groups = new Map<string, THREE.Mesh[]>();
  for (const mesh of meshes) {
    if (!mesh.userData.constructionCellRanges || mesh.geometry.index) continue;
    const metadata = mesh.userData.semanticObjectRef?.metadata;
    const key = metadata?.generatedFromAreaId ?? metadata?.lod2BuildingId;
    if (typeof key !== "string" || !key) continue;
    const group = groups.get(key) ?? []; group.push(mesh); groups.set(key, group);
  }
  let removed = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const positions: number[] = [], spans: Array<{ mesh: THREE.Mesh; start: number; end: number }> = [];
    for (const mesh of group) {
      const attribute = mesh.geometry.getAttribute("position"), start = positions.length;
      for (let index = 0; index < attribute.count; index++) positions.push(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
      spans.push({ mesh, start, end: positions.length });
    }
    const exposed = exposedPrismTriangles(positions);
    removed += exposed.removedTriangleCount;
    let cursor = 0;
    for (const { mesh, start, end } of spans) {
      const offsets: number[] = [];
      while (cursor < exposed.offsets.length && exposed.offsets[cursor]! < end) offsets.push(exposed.offsets[cursor++]! - start);
      if (offsets.length * 9 === end - start) continue;
      const originalRanges = mesh.userData.constructionCellRanges as Range[], ranges: Range[] = [];
      let ownerIndex = 0;
      for (const [index, offset] of offsets.entries()) {
        while (originalRanges[ownerIndex]!.endTriangle <= offset / 9) ownerIndex++;
        const cell = originalRanges[ownerIndex]!.cell, previous = ranges.at(-1);
        if (previous?.cell === cell) previous.endTriangle = index + 1;
        else ranges.push({ firstTriangle: index, endTriangle: index + 1, cell });
      }
      for (const [name, value] of Object.entries(mesh.geometry.attributes)) {
        const attribute = value as { itemSize: number; array: ArrayLike<number>; normalized: boolean };
        const values = new Float32Array(offsets.length * 3 * attribute.itemSize);
        let destination = 0;
        for (const offset of offsets) for (let vertex = 0; vertex < 3; vertex++) for (let component = 0; component < attribute.itemSize; component++) {
          values[destination++] = attribute.array[(offset / 3 + vertex) * attribute.itemSize + component]!;
        }
        mesh.geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize, attribute.normalized));
      }
      mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
      mesh.userData.constructionCellRanges = ranges;
      mesh.userData.removedObjectInterfaceTriangleCount = (end - start) / 9 - offsets.length;
    }
  }
  return removed;
}

/** Drop cells removed by the chunk service; never reconstruct them from stale metadata. */
export function survivingConstructionCells(
  value: unknown, occupiedCells: readonly Readonly<{ x: number; y: number; z: number }>[],
): readonly Cell[] {
  if (!Array.isArray(value)) return [];
  const occupied = new Set(occupiedCells.map((cell) => `${cell.x}:${cell.y}:${cell.z}`));
  return value.filter((cell): cell is Cell => cell && typeof cell === "object"
    && [cell.x, cell.y, cell.z].every(Number.isSafeInteger)
    && occupied.has(`${cell.x}:${cell.y}:${cell.z}`)
    && Array.isArray(cell.footprintPolygons)
    && cell.footprintPolygons.every((ring: unknown) => Array.isArray(ring) && ring.length >= 3
      && ring.every((point: unknown) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)))
    && [cell.minimumHeights, cell.maximumHeights].every((heights) => heights === undefined
      || (Array.isArray(heights) && heights.length === cell.footprintPolygons.length
        && heights.every((ring: unknown, index: number) => Array.isArray(ring)
          && ring.length === cell.footprintPolygons[index].length && ring.every(Number.isFinite)))));
}

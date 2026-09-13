import * as THREE from "three";

type Position = Readonly<{ x: number; y: number; z: number }>;
type Placement = Readonly<{
  payload: Readonly<{ metadata?: unknown; occupiedCells?: readonly Position[] }>;
  ref: Readonly<{ anchor: Position; objectInstanceId: string }>;
}>;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object"
  ? value as Record<string, unknown> : {};
const cellKey = (cell: Position): string => `${cell.x}:${cell.y}:${cell.z}`;

/** Protected routing cells never become generated meshes, including empty children. */
export function planningBuildingExpectedObjectChunks(placements: readonly Placement[], preservedCells: unknown = []): Map<string, Set<string>> {
  const protectedKeys = new Set((Array.isArray(preservedCells) ? preservedCells : []).map(value => cellKey(record(value) as Position)));
  const chunks = new Map<string, Set<string>>();
  for (const placement of placements) {
    const metadata = record(placement.payload.metadata);
    const cells = metadata.renderProfile === "construction-grid"
      ? metadata.voxelOccupancy === "none" ? [] : (placement.payload.occupiedCells ?? []).filter(cell => !protectedKeys.has(cellKey(cell)))
      : [placement.ref.anchor];
    for (const cell of cells) {
      const key = `${Math.floor(cell.x / 16)}:${Math.floor(cell.y / 16)}:${Math.floor(cell.z / 16)}`;
      let ids = chunks.get(key);
      if (!ids) { ids = new Set(); chunks.set(key, ids); }
      ids.add(placement.ref.objectInstanceId);
    }
  }
  return chunks;
}

/** Keep each surviving triangle's material when a LoD2 building leaves a shared chunk mesh. */
export function filterLod2BuildingGeometry(original: THREE.BufferGeometry, buildingIndex: number): THREE.BufferGeometry {
  const filtered = original.clone();
  const attribute = original.getAttribute("lod2BuildingIndex");
  if (!attribute) return filtered;
  const indices: number[] = [];
  const groups = [...original.groups].sort((a, b) => a.start - b.start);
  filtered.clearGroups();
  let sourceGroupIndex = 0;
  const count = original.index?.count ?? attribute.count;
  for (let i = 0; i < count; i += 3) {
    while (sourceGroupIndex < groups.length - 1 && i >= groups[sourceGroupIndex]!.start + groups[sourceGroupIndex]!.count) sourceGroupIndex++;
    const a = original.index?.getX(i) ?? i;
    if (attribute.getX(a) === buildingIndex) continue;
    const materialIndex = groups[sourceGroupIndex]?.materialIndex ?? 0;
    const last = filtered.groups.at(-1);
    if (last && last.materialIndex === materialIndex) last.count += 3;
    else filtered.addGroup(indices.length, 3, materialIndex);
    indices.push(a, original.index?.getX(i + 1) ?? i + 1, original.index?.getX(i + 2) ?? i + 2);
  }
  filtered.setIndex(indices);
  return filtered;
}

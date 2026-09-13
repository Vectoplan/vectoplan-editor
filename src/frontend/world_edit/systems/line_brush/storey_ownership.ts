import type { LineBrushBuildingBlockCell, LineBrushBuildingStoreyGeometry } from "./building_geometry";

export interface StoreyOwnershipMaterials {
  readonly wallBlockTypeId: string;
  readonly slabBlockTypeId: string;
}

/** The chunk service has one owner per integer cell. Adjacent facade prisms
 * can share that address, so each physical floor must be placed as one owner. */
export function coalesceLineBrushStoreys<T extends {
  readonly storeyIndex: number;
  readonly scope: string;
  readonly storey: LineBrushBuildingStoreyGeometry;
  readonly footprint: Readonly<Record<string, unknown>>;
}>(specs: readonly T[], materials?: StoreyOwnershipMaterials): T[] {
  const groups = new Map<number, T[]>();
  for (const spec of specs) {
    const group = groups.get(spec.storeyIndex) ?? [];
    group.push(spec);
    groups.set(spec.storeyIndex, group);
  }
  const combined: T[] = [...groups.values()].map((group) => {
    const first = group[0]!;
    if (group.length === 1) return first;
    const wallCells = group.flatMap((spec) => spec.storey.wallCells);
    const slabCells = group.flatMap((spec) => spec.storey.slabCells);
    return {
      ...first,
      scope: "all",
      footprint: { ...first.footprint, type: "MultiPolygon", coordinates: group.flatMap((spec) =>
        spec.footprint.type === "MultiPolygon"
          ? spec.footprint.coordinates as unknown[]
          : [spec.footprint.coordinates]) },
      storey: { ...first.storey, wallCells, slabCells, occupiedCells: [...wallCells, ...slabCells] },
    };
  });
  if (!materials) return combined;
  // Different per-wing floor heights can route unrelated slab/wall fragments
  // to the same integer cell, including across floor indices. One physical
  // owner keeps all fragments and each fragment's original material.
  const result = combined.map(spec => ({...spec, storey: {...spec.storey,
    wallCells: [] as LineBrushBuildingBlockCell[], slabCells: [] as LineBrushBuildingBlockCell[]}}));
  const owners = new Map<string, {cells: LineBrushBuildingBlockCell[]; material: string}>();
  for (const kind of ["slabCells", "wallCells"] as const) combined.forEach((spec, index) => {
    const material = kind === "slabCells" ? materials.slabBlockTypeId : materials.wallBlockTypeId;
    for (const cell of spec.storey[kind]) {
      const key = `${cell.x}:${cell.y}:${cell.z}`;
      let owner = owners.get(key);
      if (!owner) { owner = {cells: result[index]!.storey[kind], material}; owners.set(key, owner); }
      owner.cells.push(owner.material === material || cell.materialBlockTypeId ? cell : {...cell, materialBlockTypeId: material});
    }
  });
  return result.map(spec => ({...spec, storey: {...spec.storey,
    occupiedCells: [...spec.storey.wallCells, ...spec.storey.slabCells]}}));
}

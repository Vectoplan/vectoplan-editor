import { LOD2_STANDARD_STOREY_HEIGHT_METERS } from "../world_edit/systems/storey/height_profile";

export const LOD2_STOREY_SLAB_THICKNESS = 0.25;
/** The last partial storey is retained; an attic never adds a band above eaves. */
export function lod2StoreyBands(baseY: number, eavesY: number,
  minimumY: number, maximumY: number,
  standardHeight = LOD2_STANDARD_STOREY_HEIGHT_METERS): readonly (readonly [number, number])[] {
  if (![baseY, eavesY, minimumY, maximumY, standardHeight].every(Number.isFinite) || maximumY <= minimumY || standardHeight <= 0) return [];
  const result: Array<readonly [number, number]> = [];
  const first = Math.max(0, Math.floor((minimumY - baseY - LOD2_STOREY_SLAB_THICKNESS) / standardHeight));
  const last = Math.min(512, Math.ceil((Math.min(eavesY, maximumY) - baseY) / standardHeight));
  for (let index = first; index < last; index++) {
    const bottom = baseY + index * standardHeight;
    const top = Math.min(bottom + LOD2_STOREY_SLAB_THICKNESS, eavesY);
    if (top > minimumY + 1e-8 && bottom < maximumY - 1e-8) result.push([bottom, top]);
  }
  return result;
}

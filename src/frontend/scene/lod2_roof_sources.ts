import type { RuntimeChunkContent } from '../runtime/world/chunk_content';
import type { SemanticChunkObjectRef } from './scene_runtime';
import type { Lod2RoofSurfaceSource } from './lod2_wall_caps';
import { safeString } from '../utils/safe';

export interface IndexedLod2RoofSource extends Required<Lod2RoofSurfaceSource> { readonly id: string }
type ResolveCalculation = (id: string, value: unknown, revision: RuntimeChunkContent['chunkRevision']) => unknown;
const record = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

/** Semantic refs are immutable for a chunk snapshot. Parse the shared facade
 * once, while still resolving optimistic roof replacements on every read. */
export function createLod2RoofSourceResolver(resolve: ResolveCalculation) {
  const sources = new WeakMap<SemanticChunkObjectRef, IndexedLod2RoofSource>();
  let parses = 0;
  return {
    read(ref: SemanticChunkObjectRef, revision: RuntimeChunkContent['chunkRevision']): IndexedLod2RoofSource {
      const calculation = resolve(ref.objectInstanceId, ref.metadata.roofCalculation, revision);
      const cached = sources.get(ref);
      if (cached?.calculation === calculation) return cached;
      if (cached) {
        const updated = { ...cached, calculation }; sources.set(ref, updated); return updated;
      }
      parses++;
      const parameters = record(ref.metadata.roofParameters), source = record(parameters.importedSource);
      const facadeSegments = Array.isArray(source.facadeSegments) ? source.facadeSegments : [];
      let storeyBaseY = Infinity;
      for (const segment of facadeSegments) {
        const minimum = Number(record(segment).minimumY);
        if (Number.isFinite(minimum)) storeyBaseY = Math.min(storeyBaseY, minimum);
      }
      const next = { id: ref.objectInstanceId,
        buildingId: safeString(ref.metadata.lod2BuildingId, ref.objectInstanceId), calculation, facadeSegments,
        repairFacadeRoofSeams: source.facadeProfileMode === 'roof-clamped-v1', storeyBaseY,
        storeyEavesY: Number(parameters.eavesHeightMm) / 1000 };
      sources.set(ref, next); return next;
    },
    getParseCount: () => parses,
  };
}

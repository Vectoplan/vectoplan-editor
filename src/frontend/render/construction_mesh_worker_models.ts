import type { LineBrushBuildingBlockCell } from '../world_edit/systems/line_brush/building_geometry';

export interface ConstructionMeshWorkerGroup {
  readonly id: number;
  readonly cells: readonly LineBrushBuildingBlockCell[];
  readonly scale: number;
  readonly interfaceKey: string | null;
}

export interface ConstructionMeshWorkerBuffer {
  readonly id: number;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  /** Triples: first triangle, exclusive last triangle, original input cell index. */
  readonly ranges: Uint32Array;
  readonly cellCount: number;
  readonly removedInteriorTriangleCount: number;
  readonly removedObjectInterfaceTriangleCount: number;
  readonly bounds: readonly [number, number, number, number, number, number];
  readonly sphere: readonly [number, number, number, number];
}

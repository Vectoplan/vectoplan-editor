export type PrismPoint = readonly [number, number, number];

const samePoint = (a: PrismPoint, b: PrismPoint): boolean => Math.abs(a[0] - b[0]) < 1e-7
  && Math.abs(a[1] - b[1]) < 1e-7 && Math.abs(a[2] - b[2]) < 1e-7;

/** Use the same diagonal for either winding of a convex face. Adjacent closed
 * cells can then remove their shared face without leaving crossing triangles. */
export function appendPrismFace(points: readonly PrismPoint[], output: number[]): void {
  const ring = points.filter((point, index) => !samePoint(point, points[(index + points.length - 1) % points.length]!));
  if (ring.length < 3) return;
  let first = 0;
  for (let index = 1; index < ring.length; index++) {
    const a = ring[index]!, b = ring[first]!;
    if (a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2])))) first = index;
  }
  const a = ring[first]!;
  for (let index = 1; index + 1 < ring.length; index++) {
    const b = ring[(first + index) % ring.length]!, c = ring[(first + index + 1) % ring.length]!;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    if ((uy * vz - uz * vy) ** 2 + (uz * vx - ux * vz) ** 2 + (ux * vy - uy * vx) ** 2 > 1e-16) output.push(...a, ...b, ...c);
  }
}

/** Return original triangle offsets: callers preserve their own mining IDs and
 * material/UV attributes. Opposing faces are internal; repeated outward faces
 * are emitted once. Separate buildings never cancel one another's surfaces. */
export function exposedPrismTriangles(positions: readonly number[], namespaceAt?: (triangleOffset: number) => string | number): {
  offsets: number[]; removedTriangleCount: number;
} {
  const faces = new Map<string, { offset: number; orientation: number; internal: boolean }>();
  // Intern each spatial vertex once. Numeric ordering avoids allocating and
  // sorting three long world-coordinate strings for every submitted triangle.
  const vertices = new Map<number, Map<number, Map<number, number>>>();
  let nextVertexId = 0;
  const vertexAt = (offset: number): number => {
    const x = Math.round(positions[offset]! * 1e6), y = Math.round(positions[offset + 1]! * 1e6), z = Math.round(positions[offset + 2]! * 1e6);
    let ys = vertices.get(x);
    if (!ys) { ys = new Map(); vertices.set(x, ys); }
    let zs = ys.get(y);
    if (!zs) { zs = new Map(); ys.set(y, zs); }
    let id = zs.get(z);
    if (id === undefined) { id = nextVertexId++; zs.set(z, id); }
    return id;
  };
  for (let offset = 0; offset + 8 < positions.length; offset += 9) {
    let a = vertexAt(offset), b = vertexAt(offset + 3), c = vertexAt(offset + 6), orientation = 1;
    if (a === b || b === c || a === c) continue;
    if (a > b) { const swap = a; a = b; b = swap; orientation = -orientation; }
    if (b > c) { const swap = b; b = c; c = swap; orientation = -orientation; }
    if (a > b) { const swap = a; a = b; b = swap; orientation = -orientation; }
    const key = `${namespaceAt?.(offset) ?? ""}|${a},${b},${c}`;
    const previous = faces.get(key);
    if (!previous) faces.set(key, { offset, orientation, internal: false });
    else if (previous.orientation !== orientation) previous.internal = true;
  }
  const offsets: number[] = [];
  for (const face of faces.values()) if (!face.internal) offsets.push(face.offset);
  return { offsets, removedTriangleCount: positions.length / 9 - offsets.length };
}

import { LEGACY_STANDARD_STOREY_HEIGHT_METERS, STANDARD_STOREY_HEIGHT_METERS } from "../line_brush/building_programs";

export const STOREY_HEIGHT_PROFILE_SCHEMA_VERSION = "vectoplan.storey-height-profile.v1" as const;
export const LOD2_STANDARD_STOREY_HEIGHT_METERS = 3;
export const MAX_PROFILE_STOREYS = 512;
export type StoreyHeightScope = "all" | `segment:${number}`;
/** Metres relative to building baseY. The final boundary is the actual eaves,
 * including a retained partial top storey. Persist this alongside count metadata. */
export interface BuildingStoreyHeightProfile {
  readonly schemaVersion: typeof STOREY_HEIGHT_PROFILE_SCHEMA_VERSION;
  readonly defaultHeightMeters: number;
  readonly boundariesByScope: Readonly<Record<string, readonly number[]>>;
}
export interface CreateStoreyHeightProfileInput {
  readonly baseCount: number;
  readonly defaultHeightMeters?: number;
  readonly topHeightMeters?: number;
  readonly scopeCounts?: Readonly<Record<string, number>>;
  readonly scopeTopHeights?: Readonly<Record<string, number>>;
}
const scopeKey = (scope: string): string => /^\d+$/.test(scope) ? `segment:${scope}` : scope;
const validScope = (scope: string): boolean => scope === "all" || /^segment:\d+$/.test(scope);
const rounded = (value: number): number => Math.round(value * 1e9) / 1e9;
function countValue(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PROFILE_STOREYS) throw new Error("Ungültige Geschossanzahl (1 bis 512).");
  return value;
}
function heightValue(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1000) throw new Error("Ungültige Geschosshöhe.");
  return value;
}
function initialBoundaries(count: number, standard: number, top?: number): readonly number[] {
  countValue(count);
  if (top === undefined) return Array.from({length: count + 1}, (_, i) => rounded(i * standard));
  if (!Number.isFinite(top) || top <= 0) throw new Error("Ungültige Gebäudehöhe.");
  // Imported counts use ceil(top/standard). A deliberately retained custom count
  // must also remain viable after a separate roof edit: only compress if needed.
  const step = top > (count - 1) * standard ? standard : top / count;
  return [...Array.from({length: count}, (_, i) => rounded(i * step)), rounded(top)];
}
export function createStoreyHeightProfile(input: CreateStoreyHeightProfileInput): BuildingStoreyHeightProfile {
  const standard = heightValue(input.defaultHeightMeters ?? STANDARD_STOREY_HEIGHT_METERS);
  const counts = Object.fromEntries(Object.entries(input.scopeCounts ?? {}).map(([key, value]) => [scopeKey(key), value]));
  const tops = Object.fromEntries(Object.entries(input.scopeTopHeights ?? {}).map(([key, value]) => [scopeKey(key), value]));
  const boundariesByScope: Record<string, readonly number[]> = {
    all: initialBoundaries(input.baseCount, standard, input.topHeightMeters),
  };
  for (const raw of new Set([...Object.keys(counts), ...Object.keys(tops)])) {
    const scope = scopeKey(raw);
    if (!validScope(scope) || scope === "all") continue;
    const top = tops[scope];
    const count = counts[scope] ?? (top === undefined ? input.baseCount : Math.max(1, Math.ceil((top - 1e-6) / standard)));
    boundariesByScope[scope] = initialBoundaries(count, standard, top);
  }
  return {schemaVersion: STOREY_HEIGHT_PROFILE_SCHEMA_VERSION, defaultHeightMeters: standard, boundariesByScope};
}
/** Missing legacy profiles return null; callers keep their existing count model. */
export function normalizeStoreyHeightProfile(value: unknown): BuildingStoreyHeightProfile | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== STOREY_HEIGHT_PROFILE_SCHEMA_VERSION || !Number.isFinite(raw.defaultHeightMeters)
    || Number(raw.defaultHeightMeters) <= 0 || Number(raw.defaultHeightMeters) > 1000
    || !raw.boundariesByScope || typeof raw.boundariesByScope !== "object") return null;
  const boundariesByScope: Record<string, readonly number[]> = {};
  for (const [scope, values] of Object.entries(raw.boundariesByScope)) {
    if (!validScope(scope) || !Array.isArray(values) || values.length < 2 || values.length > MAX_PROFILE_STOREYS + 1
      || values[0] !== 0 || !values.every((v, i) => Number.isFinite(v) && (i === 0 || v > values[i - 1]))) return null;
    boundariesByScope[scope] = [...values];
  }
  if (!boundariesByScope.all) return null;
  return {schemaVersion: STOREY_HEIGHT_PROFILE_SCHEMA_VERSION, defaultHeightMeters: Number(raw.defaultHeightMeters), boundariesByScope};
}
/** Only the old, untouched Linebrush standard migrates. A moved slab, partial
 * top floor or custom default is a user-authored dimension and stays exact.
 * Imported LoD2 profiles are deliberately not passed through this adapter. */
export function migrateLegacyLineBrushHeightProfile(profile: BuildingStoreyHeightProfile): BuildingStoreyHeightProfile {
  const legacy = LEGACY_STANDARD_STOREY_HEIGHT_METERS;
  if (Math.abs(profile.defaultHeightMeters - legacy) > 1e-8
    || Object.values(profile.boundariesByScope).some(values => values.some((value, index) => Math.abs(value - index * legacy) > 1e-8))) return profile;
  return {...profile, defaultHeightMeters: STANDARD_STOREY_HEIGHT_METERS,
    boundariesByScope: Object.fromEntries(Object.entries(profile.boundariesByScope).map(([scope, values]) =>
      [scope, values.map((_, index) => index * STANDARD_STOREY_HEIGHT_METERS)]))};
}
export function storeyScopeBoundaries(profile: BuildingStoreyHeightProfile, scope: string = "all"): readonly number[] {
  return profile.boundariesByScope[scopeKey(scope)] ?? profile.boundariesByScope.all!;
}
export function storeyScopeHeights(profile: BuildingStoreyHeightProfile, scope: string = "all"): readonly number[] {
  const boundaries = storeyScopeBoundaries(profile, scope);
  return boundaries.slice(1).map((top, i) => rounded(top - boundaries[i]!));
}
/** Resize from the top. Existing individual heights survive; new floors use the
 * profile's original standard. "all" applies the same count delta to each wing. */
export function resizeStoreyHeightProfile(profile: BuildingStoreyHeightProfile, scope: string,
  newCount: number): BuildingStoreyHeightProfile {
  countValue(newCount);
  const key = scopeKey(scope), previous = storeyScopeBoundaries(profile, key), change = newCount - previous.length + 1;
  const resize = (values: readonly number[], count: number): readonly number[] => {
    countValue(count);
    const next = values.slice(0, count + 1);
    while (next.length <= count) next.push(rounded(next.at(-1)! + profile.defaultHeightMeters));
    return next;
  };
  const boundariesByScope = {...profile.boundariesByScope};
  if (key === "all") for (const [other, values] of Object.entries(boundariesByScope)) {
    boundariesByScope[other] = resize(values, Math.max(1, values.length - 1 + change));
  } else {
    if (!validScope(key)) throw new Error("Ungültiger Gebäudeteil.");
    boundariesByScope[key] = resize(previous, newCount);
  }
  return {...profile, boundariesByScope};
}
/** Move one slab boundary; adjacent storeys absorb each other's height and the
 * eaves remain fixed. Imported very thin partial floors survive normalization;
 * interactive movement maintains at least 0.25m, or the smaller original gap. */
export function moveStoreyBoundary(profile: BuildingStoreyHeightProfile, scope: string,
  boundaryIndex: number, newOffset: number): BuildingStoreyHeightProfile {
  const key = scopeKey(scope), previous = storeyScopeBoundaries(profile, key);
  if (!validScope(key) || !Number.isInteger(boundaryIndex) || boundaryIndex <= 0
    || boundaryIndex >= previous.length - 1 || !Number.isFinite(newOffset)) throw new Error("Nur innere Geschossgrenzen können verschoben werden.");
  const shift = newOffset - previous[boundaryIndex]!;
  const move = (values: readonly number[]): readonly number[] => {
    if (boundaryIndex >= values.length - 1) return values;
    const before = values[boundaryIndex - 1]!, old = values[boundaryIndex]!, after = values[boundaryIndex + 1]!;
    const lower = before + Math.min(.25, old - before), upper = after - Math.min(.25, after - old);
    return values.map((value, index) => index === boundaryIndex ? rounded(Math.max(lower, Math.min(upper, old + shift))) : value);
  };
  const boundariesByScope = {...profile.boundariesByScope};
  if (key === "all") for (const [other, values] of Object.entries(boundariesByScope)) boundariesByScope[other] = move(values);
  else boundariesByScope[key] = move(previous);
  return {...profile, boundariesByScope};
}

/** Move the eaves boundary without changing lower slabs. An all-building move
 * applies the same metre offset to every component, preserving annex steps. */
export function setStoreyTopHeight(profile: BuildingStoreyHeightProfile, scope: string,
  newTop: number): BuildingStoreyHeightProfile {
  const key = scopeKey(scope), previous = storeyScopeBoundaries(profile, key);
  if (!validScope(key) || !Number.isFinite(newTop)) throw new Error("Ungültige Gebäudehöhe.");
  const shift = newTop - previous.at(-1)!;
  const move = (values: readonly number[]): readonly number[] => {
    const old = values.at(-1)!, lower = values.at(-2)!;
    return [...values.slice(0, -1), rounded(Math.max(lower + Math.min(.25, old - lower), old + shift))];
  };
  const boundariesByScope = {...profile.boundariesByScope};
  if (key === "all") for (const [other, values] of Object.entries(boundariesByScope)) boundariesByScope[other] = move(values);
  else boundariesByScope[key] = move(previous);
  return {...profile, boundariesByScope};
}

/** Adopt a separately edited roof's exact eaves. Existing interior slab levels
 * survive; a lowered roof removes only boundaries it physically passes. Unlike
 * interactive dragging this must retain arbitrarily thin imported remainders. */
export function rebaseStoreyProfileTops(profile: BuildingStoreyHeightProfile,
  scopeTopHeights: Readonly<Record<string, number>>): BuildingStoreyHeightProfile {
  const boundariesByScope = {...profile.boundariesByScope};
  for (const [rawScope, top] of Object.entries(scopeTopHeights)) {
    const scope = scopeKey(rawScope);
    if (!validScope(scope) || !Number.isFinite(top) || top <= 0) throw new Error("Ungültige neue Traufhöhe.");
    const previous = storeyScopeBoundaries(profile, scope);
    const interior = previous.slice(0, -1).filter(value => value < top - 1e-8);
    boundariesByScope[scope] = [...interior, rounded(top)];
  }
  return {...profile, boundariesByScope};
}

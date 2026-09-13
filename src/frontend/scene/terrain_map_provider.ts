/** Standard XYZ raster fallback tiles. A configured proxy
 * may supply its own URL and attribution without changing terrain geometry,
 * zoom, georeferencing or the tile cache. No paid provider is enabled by default.
 */
export interface TerrainMapProvider {
  readonly id: string;
  readonly label: string;
  readonly tileUrl: string;
  readonly attribution: Readonly<{ label: string; url: string }>;
}

export const OPEN_STREET_MAP_PROVIDER: TerrainMapProvider = Object.freeze({
  id: 'osm', label: 'OpenStreetMap', tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: Object.freeze({ label: '© OpenStreetMap-Mitwirkende', url: 'https://www.openstreetmap.org/copyright' }),
});

export function terrainMapProviderFromUnknown(value: unknown): TerrainMapProvider | null {
  if (typeof value === 'string') {
    try { return terrainMapProviderFromUnknown(JSON.parse(value)); } catch { return null; }
  }
  if (!value || typeof value !== 'object') return null;
  const provider = value as TerrainMapProvider;
  if ((typeof provider.id === 'string' && provider.id.toLowerCase().startsWith('mapbox'))
    || (typeof provider.tileUrl === 'string' && /^https?:\/\/[^/]*mapbox\.com(?:\/|$)/i.test(provider.tileUrl))) return null;
  if (typeof provider.id !== 'string' || !provider.id.trim() || typeof provider.label !== 'string' || !provider.label.trim()
    || typeof provider.tileUrl !== 'string' || !['{z}', '{x}', '{y}'].every(part => provider.tileUrl.includes(part))
    || typeof provider.attribution?.label !== 'string' || !provider.attribution.label.trim()
    || typeof provider.attribution?.url !== 'string' || !/^https?:\/\//i.test(provider.attribution.url)) return null;
  if (!/^https?:\/\//i.test(provider.tileUrl) && !provider.tileUrl.startsWith('/')) return null;
  return { id: provider.id.trim(), label: provider.label.trim(), tileUrl: provider.tileUrl,
    attribution: { label: provider.attribution.label, url: provider.attribution.url } };
}

/** Always retain the public OSM source if a configured style/proxy fails. */
export function terrainMapProviderChain(primary?: TerrainMapProvider | null, osmProxyUrl?: string): readonly TerrainMapProvider[] {
  const configured = terrainMapProviderFromUnknown(primary)
    ?? (osmProxyUrl ? terrainMapProviderFromUnknown({ ...OPEN_STREET_MAP_PROVIDER, id: 'osm-proxy', tileUrl: osmProxyUrl }) : null);
  return configured && configured.tileUrl !== OPEN_STREET_MAP_PROVIDER.tileUrl
    ? [configured, OPEN_STREET_MAP_PROVIDER] : [OPEN_STREET_MAP_PROVIDER];
}

export function terrainMapTileUrl(provider: TerrainMapProvider, zoom: number, x: number, y: number): string {
  return provider.tileUrl.replaceAll('{z}', String(zoom)).replaceAll('{x}', String(x)).replaceAll('{y}', String(y));
}

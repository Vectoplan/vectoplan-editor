import assert from 'node:assert/strict';
import test from 'node:test';
import { OPEN_STREET_MAP_PROVIDER, terrainMapProviderChain, terrainMapProviderFromUnknown, terrainMapTileUrl } from '../src/frontend/scene/terrain_map_provider';
import { terrainRendererUrl } from '../src/frontend/scene/terrain_map_bridge';

test('renderer shares the local map storage origin without rewriting configured remote hosts', () => {
  assert.equal(terrainRendererUrl('http://localhost:5190/map/terrain', 'http://127.0.0.1:5100/editor').href, 'http://127.0.0.1:5190/map/terrain');
  assert.equal(terrainRendererUrl('https://maps.example.org/map/terrain', 'https://editor.example.org/editor').href, 'https://maps.example.org/map/terrain');
  assert.throws(() => terrainRendererUrl('javascript:alert(1)', 'http://localhost:5100'));
});

test('OSM is the default and remains the last fallback of a configured light raster style', () => {
  assert.deepEqual(terrainMapProviderChain(), [OPEN_STREET_MAP_PROVIDER]);
  const custom = { id: 'custom-light', label: 'Custom Light',
    tileUrl: '/configured-map-source/light/{z}/{x}/{y}.png',
    attribution: { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' } };
  const providers = terrainMapProviderChain(custom);
  assert.equal(providers[0]!.id, 'custom-light');
  assert.equal(providers[1], OPEN_STREET_MAP_PROVIDER);
  assert.equal(terrainMapTileUrl(providers[0]!, 19, 123, 456), '/configured-map-source/light/19/123/456.png');
  assert.deepEqual(terrainMapProviderFromUnknown(JSON.stringify(custom)), custom);
});

test('Mapbox configuration cannot reactivate a disabled design provider', () => {
  assert.equal(terrainMapProviderFromUnknown({...OPEN_STREET_MAP_PROVIDER, id: 'mapbox-light'}), null);
  assert.equal(terrainMapProviderFromUnknown({...OPEN_STREET_MAP_PROVIDER, tileUrl: 'https://api.mapbox.com/{z}/{x}/{y}'}), null);
});

test('CAD and 3D forward their project identity to the same persistent map package', () => {
  assert.equal(terrainRendererUrl('http://localhost:5190/map/terrain', 'http://localhost:5104/cad?core_project_id=core_123').searchParams.get('map_project_id'), 'core_123');
  assert.equal(terrainRendererUrl('http://localhost:5190/map/terrain', 'http://localhost:5100/editor', 'chunk_123').searchParams.get('map_project_id'), 'chunk_123');
});

test('invalid sources fail back to OSM and an existing OSM proxy keeps a public fallback', () => {
  assert.equal(terrainMapProviderFromUnknown('{broken'), null);
  assert.equal(terrainMapProviderFromUnknown({ ...OPEN_STREET_MAP_PROVIDER, tileUrl: 'javascript:{z}/{x}/{y}' }), null);
  assert.equal(terrainMapProviderFromUnknown({ ...OPEN_STREET_MAP_PROVIDER, tileUrl: '/tiles/{x}/{y}' }), null);
  assert.deepEqual(terrainMapProviderChain(OPEN_STREET_MAP_PROVIDER), [OPEN_STREET_MAP_PROVIDER]);
  const proxy = terrainMapProviderChain(undefined, '/osm/{z}/{x}/{y}.png');
  assert.equal(proxy[0]!.id, 'osm-proxy'); assert.equal(proxy[1], OPEN_STREET_MAP_PROVIDER);
});

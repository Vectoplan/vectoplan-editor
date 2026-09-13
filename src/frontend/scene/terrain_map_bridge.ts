import { OPEN_STREET_MAP_PROVIDER, terrainMapTileUrl } from './terrain_map_provider';

const CONTRACT = 'vectoplan-terrain-map.v1';
export interface TerrainMapState { readonly designId: 'light' | 'dark'; readonly provider: string; readonly revision: number; }
export interface TerrainMapImage { readonly image: HTMLCanvasElement | HTMLImageElement; readonly provider: string; }
export interface TerrainMapBridge {
  tile(z: number, x: number, y: number, signal?: AbortSignal): Promise<TerrainMapImage>;
  destroy(): void;
}

export function terrainRendererUrl(configured: string, editorLocation: string, projectId?: string): URL {
  const editor = new URL(editorLocation);
  const renderer = new URL(configured, editor);
  if (!/^https?:$/.test(renderer.protocol)) throw new Error('Invalid map renderer URL');
  // The App applies the same loopback-host rule to its map/editor iframe URLs.
  // Keep /map and /map/terrain on the identical storage origin in local use.
  const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (loopback.has(renderer.hostname) && loopback.has(editor.hostname)) renderer.hostname = editor.hostname;
  const identity = projectId || editor.searchParams.get('core_project_id') || editor.searchParams.get('project_public_id') || editor.searchParams.get('app_project_public_id');
  if (identity && /^[A-Za-z0-9_-]{1,160}$/.test(identity)) renderer.searchParams.set('map_project_id', identity);
  return renderer;
}

export function loadTerrainRaster(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous'; image.referrerPolicy = 'strict-origin-when-cross-origin';
    const finish = (error?: Error) => {
      clearTimeout(timeout); image.onload = image.onerror = null;
      if (error) reject(error); else resolve(image);
    };
    const timeout = window.setTimeout(() => finish(new Error('Map tile timeout')), 15000);
    image.onload = () => finish(); image.onerror = () => finish(new Error('Map tile unavailable'));
    image.src = url;
  });
}

/** OpenLayer owns the preference, provider policy and browser renderer. Its
 * iframe shares storage with /map even though the editor uses another origin.
 * Only rendered RGBA tiles cross this bridge; no chunk/parcel writes occur.
 */
export function createTerrainMapBridge(rendererUrl: string, onState: (state: TerrainMapState) => void,
  options: { fallbackToOsm?: boolean; projectId?: string } = {}): TerrainMapBridge {
  const url = terrainRendererUrl(rendererUrl, window.location.href, options.projectId);
  const frame = document.createElement('iframe');
  frame.title = 'Kartentexturen'; frame.tabIndex = -1; frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:768px;height:768px;border:0;pointer-events:none';
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  let state: TerrainMapState | null = null, unavailable = false, destroyed = false, sequence = 0;
  let readyResolve!: () => void;
  const ready = new Promise<void>(resolve => { readyResolve = resolve; });
  const pending = new Map<number, { resolve: (value: TerrainMapImage) => void; reject: (error: Error) => void; timeout: number; cleanup: () => void }>();
  function cancelPending(): void {
    for (const job of pending.values()) { clearTimeout(job.timeout); job.cleanup(); job.reject(new Error('Map generation changed')); }
    pending.clear();
  }
  function failed(): void {
    if (destroyed || state) return;
    unavailable = true; readyResolve();
    onState({ designId: 'light', provider: 'osm', revision: -1 });
  }
  const initializationTimeout = window.setTimeout(failed, 15000);
  function receive(event: MessageEvent): void {
    if (destroyed || event.source !== frame.contentWindow || event.origin !== url.origin || event.data?.contract !== CONTRACT) return;
    const data = event.data;
    if (data.type === 'unavailable') { failed(); return; }
    if (data.type === 'state' && (data.designId === 'light' || data.designId === 'dark')
      && ['mapbox', 'openfreemap', 'osm'].includes(data.provider) && Number.isSafeInteger(data.revision)) {
      if (state?.revision === data.revision && state.provider === data.provider && state.designId === data.designId) return;
      cancelPending(); clearTimeout(initializationTimeout);
      state = { designId: data.designId, provider: data.provider, revision: data.revision };
      unavailable = false; onState(state); readyResolve(); return;
    }
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id); clearTimeout(job.timeout); job.cleanup();
    if (data.type !== 'tile' || data.revision !== state?.revision || data.designId !== state.designId
      || data.provider !== state.provider || data.width !== 256 || data.height !== 256
      || !(data.pixels instanceof ArrayBuffer) || data.pixels.byteLength !== 256 * 256 * 4) {
      job.reject(new Error('Map tile unavailable')); return;
    }
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data.pixels), 256, 256), 0, 0);
    job.resolve({ image: canvas, provider: data.provider });
  }
  window.addEventListener('message', receive);
  frame.src = url.href; document.body.append(frame);
  return {
    async tile(z, x, y, signal) {
      await ready;
      if (signal?.aborted) throw new DOMException('Map tile cancelled', 'AbortError');
      if (destroyed) throw new Error('Map renderer disposed');
      if (unavailable && options.fallbackToOsm === false) throw new Error('Map renderer unavailable');
      if (unavailable) return { image: await loadTerrainRaster(terrainMapTileUrl(OPEN_STREET_MAP_PROVIDER, z, x, y)), provider: 'osm' };
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const cancel = () => {
          pending.delete(id); clearTimeout(timeout); cleanup();
          frame.contentWindow?.postMessage({ contract: CONTRACT, type: 'tile-cancel', id }, url.origin);
          reject(new DOMException('Map tile cancelled', 'AbortError'));
        };
        const cleanup = () => signal?.removeEventListener('abort', cancel);
        const timeout = window.setTimeout(() => { pending.delete(id); cleanup(); reject(new Error('Map render timeout')); }, 40000);
        pending.set(id, { resolve, reject, timeout, cleanup });
        signal?.addEventListener('abort', cancel, { once: true });
        frame.contentWindow!.postMessage({ contract: CONTRACT, type: 'tile', id, z, x, y, revision: state!.revision }, url.origin);
      });
    },
    destroy() {
      destroyed = true; readyResolve(); clearTimeout(initializationTimeout); cancelPending();
      window.removeEventListener('message', receive); frame.remove();
    },
  };
}

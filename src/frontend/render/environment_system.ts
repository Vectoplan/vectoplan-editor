import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import type { EditorBootstrap } from "@bootstrap/bootstrap_models";

export interface EnvironmentSnapshot {
  readonly simulatedTimeIso: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly sunElevationDegrees: number;
  readonly sunAzimuthDegrees: number;
  readonly running: boolean;
  readonly timeScale: number;
}

export interface EnvironmentSystem {
  update(deltaSeconds: number): void;
  getSnapshot(): EnvironmentSnapshot;
  destroy(): void;
}

export interface EnvironmentSystemOptions {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controlsHost: HTMLElement;
  readonly bootstrap: EditorBootstrap;
}

interface SolarPosition {
  readonly elevation: number;
  readonly azimuth: number;
}

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const STATIC_SUN_MONTH_INDEX = 6;
const STATIC_SUN_DAY = 28;
const STATIC_SUN_HOUR = 16;
const STATIC_SUN_MINUTE = 48;
const DEFAULT_LATITUDE = 51.1657;
const DEFAULT_LONGITUDE = 10.4515;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function nestedNumber(root: unknown, paths: readonly (readonly string[])[]): number | null {
  for (const path of paths) {
    let cursor: unknown = root;
    for (const segment of path) {
      cursor = asRecord(cursor)?.[segment];
    }
    const number = Number(cursor);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

function resolveGeoReference(bootstrap: EditorBootstrap): {
  latitude: number;
  longitude: number;
  trueNorthDegrees: number;
} {
  const latitude = nestedNumber(bootstrap, [
    ["environment", "latitude"],
    ["environment", "location", "latitude"],
    ["world", "earthReference", "latitude"],
    ["world", "globalReference", "latitude"],
    ["earthReference", "latitude"],
  ]) ?? DEFAULT_LATITUDE;
  const longitude = nestedNumber(bootstrap, [
    ["environment", "longitude"],
    ["environment", "location", "longitude"],
    ["world", "earthReference", "longitude"],
    ["world", "globalReference", "longitude"],
    ["earthReference", "longitude"],
  ]) ?? DEFAULT_LONGITUDE;
  const trueNorthDegrees = nestedNumber(bootstrap, [
    ["environment", "trueNorthDegrees"],
    ["world", "earthReference", "trueNorthDegrees"],
    ["world", "globalReference", "trueNorthDegrees"],
  ]) ?? 0;
  return {
    latitude: THREE.MathUtils.clamp(latitude, -89.9, 89.9),
    longitude: THREE.MathUtils.clamp(longitude, -180, 180),
    trueNorthDegrees,
  };
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
}

/** NOAA-style approximation used for interactive daylight preview. */
function solarPosition(date: Date, latitude: number, longitude: number): SolarPosition {
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3_600;
  const gamma = (2 * Math.PI / 365) * (dayOfYear(date) - 1 + (hours - 12) / 24);
  const equationOfTime = 229.18 * (
    0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma)
  );
  const declination = 0.006918 - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);
  const timezoneHours = -date.getTimezoneOffset() / 60;
  const trueSolarMinutes = (
    hours * 60 + equationOfTime + 4 * longitude - 60 * timezoneHours + 1_440
  ) % 1_440;
  const hourAngle = (trueSolarMinutes / 4 - 180) * DEG_TO_RAD;
  const latitudeRad = latitude * DEG_TO_RAD;
  const cosZenith = THREE.MathUtils.clamp(
    Math.sin(latitudeRad) * Math.sin(declination)
      + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngle),
    -1,
    1,
  );
  return {
    elevation: Math.asin(cosZenith),
    azimuth: Math.atan2(
      Math.sin(hourAngle),
      Math.cos(hourAngle) * Math.sin(latitudeRad) - Math.tan(declination) * Math.cos(latitudeRad),
    ) + Math.PI,
  };
}

function createStaticSunTime(): Date {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    STATIC_SUN_MONTH_INDEX,
    STATIC_SUN_DAY,
    STATIC_SUN_HOUR,
    STATIC_SUN_MINUTE,
    0,
    0,
  );
}

export function createEnvironmentSystem(options: EnvironmentSystemOptions): EnvironmentSystem {
  const { scene, renderer, camera } = options;
  const geo = resolveGeoReference(options.bootstrap);
  const simulatedTimeMs = createStaticSunTime().getTime();
  const running = false;
  const timeScale = 0;
  let dirty = true;
  let destroyed = false;
  let lastUpdateAt = -Infinity;
  let solar = solarPosition(new Date(), geo.latitude, geo.longitude);

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const sky = new Sky();
  sky.name = "vectoplan-physical-sky";
  sky.scale.setScalar(450_000);
  sky.material.uniforms.turbidity.value = 6.5;
  sky.material.uniforms.rayleigh.value = 2.1;
  sky.material.uniforms.mieCoefficient.value = 0.006;
  sky.material.uniforms.mieDirectionalG.value = 0.82;

  const hemisphere = new THREE.HemisphereLight(0xbddcff, 0x4a4033, 0.55);
  hemisphere.name = "vectoplan-sky-fill-light";
  const sun = new THREE.DirectionalLight(0xfff3d6, 3.2);
  sun.name = "vectoplan-sun-light";
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.camera.left = -72;
  sun.shadow.camera.right = 72;
  sun.shadow.camera.top = 72;
  sun.shadow.camera.bottom = -72;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.target.name = "vectoplan-sun-target";

  scene.background = null;
  scene.fog = new THREE.FogExp2(0xb9d8eb, 0.0013);
  scene.add(sky, hemisphere, sun, sun.target);
  // The viewport overlay also owns the crosshair and editor HUD. Environment
  // controls must never clear or hide that shared host.
  options.controlsHost.hidden = false;
  options.controlsHost.removeAttribute("hidden");
  options.controlsHost.dataset.environmentMode = "fixed";
  options.controlsHost.dataset.environmentTime = "07-28T16:48";
  const direction = new THREE.Vector3();
  const center = new THREE.Vector3();
  const nightFog = new THREE.Color(0x111827);
  const dayFog = new THREE.Color(0xb9d8eb);

  function updateSolar(nowMs: number): void {
    const date = new Date(simulatedTimeMs);
    solar = solarPosition(date, geo.latitude, geo.longitude);
    const azimuth = solar.azimuth + geo.trueNorthDegrees * DEG_TO_RAD;
    const radius = Math.cos(solar.elevation);
    direction.set(
      Math.sin(azimuth) * radius,
      Math.sin(solar.elevation),
      Math.cos(azimuth) * radius,
    ).normalize();
    sky.material.uniforms.sunPosition.value.copy(direction);

    const daylight = THREE.MathUtils.smoothstep(solar.elevation * RAD_TO_DEG, -6, 8);
    sun.intensity = daylight * 3.2;
    hemisphere.intensity = 0.08 + daylight * 0.58;
    renderer.toneMappingExposure = 0.55 + daylight * 0.58;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(nightFog).lerp(dayFog, daylight);
    }

    center.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
    sun.position.copy(center).addScaledVector(direction, 130);
    sun.target.position.copy(center);
    sun.target.updateMatrixWorld();

    lastUpdateAt = nowMs;
    dirty = false;
  }

  updateSolar(performance.now());
  return {
    update(deltaSeconds): void {
      if (destroyed) {
        return;
      }
      void deltaSeconds;
      const nowMs = performance.now();
      if (dirty || nowMs - lastUpdateAt >= 200) {
        updateSolar(nowMs);
      } else {
        center.set(camera.position.x, camera.position.y - 1.6, camera.position.z);
        sun.position.copy(center).addScaledVector(direction, 130);
        sun.target.position.copy(center);
      }
    },
    getSnapshot: () => ({
      simulatedTimeIso: new Date(simulatedTimeMs).toISOString(),
      latitude: geo.latitude,
      longitude: geo.longitude,
      sunElevationDegrees: solar.elevation * RAD_TO_DEG,
      sunAzimuthDegrees: solar.azimuth * RAD_TO_DEG,
      running,
      timeScale,
    }),
    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      scene.remove(sky, hemisphere, sun, sun.target);
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.map?.dispose();
    },
  };
}

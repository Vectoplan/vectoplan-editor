import * as THREE from "three";
import { disposePreviewObject } from "./reconstruction_preview_resources";

export const CAD_STATIONS = ["import", "bridge", "output"] as const;
export type CadStation = typeof CAD_STATIONS[number];
const COLORS = { import: 0x7195ab, bridge: 0xc28b43, output: 0x419b90 };
const MAX_OBJECTS = 1_000;
const MAX_VERTICES = 300_000;
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const caption = (v: unknown, fallback = ""): string => String(v ?? fallback).slice(0, 180);

/** Presentation transforms only: every station retains the same metric scale/origin. */
export function cadStationLayout(bounds: THREE.Box3) {
  const valid = !bounds.isEmpty();
  const size = valid ? bounds.getSize(new THREE.Vector3()) : new THREE.Vector3(12, 6, 8);
  const center = valid ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3();
  const width = Math.max(8, size.x * 1.2);
  const depth = Math.max(6, size.z * 1.2);
  const gap = Math.max(3, width * 0.22);
  return {
    width, depth, gap,
    origin: new THREE.Vector3(-center.x, (valid ? -bounds.min.y : 0) + 0.12, -center.z),
    offsets: [-(width + gap), 0, width + gap],
  };
}

interface Station {
  group: THREE.Group;
  content: THREE.Group;
  plate: THREE.Mesh;
  bounds: THREE.Box3;
  objects: Map<string, THREE.Object3D>;
  label: HTMLElement | null;
  state: string;
  detail: string;
  title: string;
  geometries: number;
  vertices: number;
  rejected: number;
}

/** Three work positions inside the existing editor scene and WebGL renderer. */
export class CadConversionScene {
  readonly root = new THREE.Group();
  readonly stations: Record<CadStation, Station>;
  readonly bounds = new THREE.Box3();
  private sourceBounds = new THREE.Box3();
  private layout = cadStationLayout(this.sourceBounds);

  constructor(
    private buildObject: (value: Record<string, unknown>) => THREE.Object3D | null,
    host?: HTMLElement,
  ) {
    this.root.name = "cadbridge_conversion_stations";
    this.root.visible = false;
    this.stations = {} as Record<CadStation, Station>;
    CAD_STATIONS.forEach((phase) => {
      const group = new THREE.Group(), content = new THREE.Group();
      group.name = `cad_station_${phase}`;
      content.name = `cad_geometry_${phase}`;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({color: 0xf7f9fa, roughness: 0.9}));
      plate.receiveShadow = true;
      const border = new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry),
        new THREE.LineBasicMaterial({color: COLORS[phase], transparent: true, opacity: 0.55}));
      plate.add(border);
      group.add(plate, content);
      this.root.add(group);
      const label = host ? document.createElement("div") : null;
      if (label && host) {
        label.className = "reconstruction-preview__cad-station";
        label.dataset.cadStation = phase;
        label.hidden = true;
        label.setAttribute("role", "status");
        host.append(label);
      }
      this.stations[phase] = {group, content, plate, label, bounds: new THREE.Box3(),
        objects: new Map(), state: "waiting", detail: "", title: "", geometries: 0,
        vertices: 0, rejected: 0};
    });
    this.reset({});
  }

  setVisible(visible: boolean) {
    this.root.visible = visible;
    for (const station of Object.values(this.stations)) if (station.label) station.label.hidden = !visible;
  }

  reset(payload: Record<string, unknown>) {
    this.clear();
    this.stations.import.title = "Import";
    this.stations.bridge.title = "CAD Bridge";
    this.stations.output.title = caption(payload.targetLabel || payload.targetFormat, "Ausgabe");
    this.stations.import.detail = caption(payload.sourceFilename, "Quelldatei");
    this.stations.bridge.detail = "Neutrales Brückenmodell";
    this.stations.output.detail = "Gewähltes Ausgabeformat";
    this.relayout();
  }

  clear() {
    for (const station of Object.values(this.stations)) {
      for (const object of station.objects.values()) disposePreviewObject(object);
      station.content.clear();
      station.objects.clear();
      station.bounds.makeEmpty();
      station.state = "waiting";
      station.geometries = station.vertices = station.rejected = 0;
    }
    this.sourceBounds.makeEmpty();
  }

  apply(payload: Record<string, unknown>) {
    const data = record(payload.data), stage = record(payload.stage);
    const phase = data.phase as CadStation;
    if (payload.targetLabel) this.stations.output.title = caption(payload.targetLabel);
    if (payload.eventType === "cad.progress" && CAD_STATIONS.includes(phase)) {
      const station = this.stations[phase];
      const incoming = Array.isArray(data.objects) ? data.objects.slice(0, MAX_OBJECTS) : [];
      for (const raw of incoming) {
        const item = record(raw), id = caption(item.id);
        // Events are append-only. Replay never duplicates a shape within a station.
        if (!id || station.objects.has(id)) continue;
        if (station.objects.size >= MAX_OBJECTS) { station.rejected++; continue; }
        const object = this.buildObject(item);
        if (!object) { station.rejected++; continue; }
        let vertices = 0;
        object.traverse((node) => {
          const shape = node as THREE.Mesh;
          if (shape.geometry instanceof THREE.BufferGeometry)
            vertices += shape.geometry.getAttribute("position")?.count ?? 0;
        });
        if (station.vertices + vertices > MAX_VERTICES) {
          disposePreviewObject(object); station.rejected++; continue;
        }
        object.traverse((node) => {
          const shape = node as THREE.Mesh;
          // The shared scene spans three models. Avoid self-shadow artifacts
          // from the editor's fixed shadow frustum when comparing their surfaces.
          shape.receiveShadow = false;
          const materials = Array.isArray(shape.material) ? shape.material : [shape.material];
          for (const material of materials) if (material && "color" in material)
            (material as THREE.MeshStandardMaterial).color.setHex(COLORS[phase]);
        });
        object.updateMatrixWorld(true);
        // Calculate raw model bounds before attaching to a translated station.
        station.bounds.union(new THREE.Box3().setFromObject(object, true));
        station.content.add(object);
        station.objects.set(id, object);
        station.vertices += vertices;
      }
      station.geometries = Number.isSafeInteger(data.geometryCount) ? Number(data.geometryCount) : station.objects.size;
      station.state = data.state === "completed" ? "completed" : "running";
      station.detail = `${station.geometries} Geometrien · ${station.objects.size} sichtbar`;
      if (Number(data.lossCount) > 0) station.detail += ` · ${data.lossCount} Verluste`;
      if (station.rejected) station.detail += ` · ${station.rejected} begrenzt`;
    } else if (payload.eventType === "workflow.stage") {
      const mapping: Record<string, CadStation> = {
        source_detection: "import", source_import: "import", bridge_validation: "bridge",
        quality_gate: "bridge", target_export: "output", target_reimport: "output",
      };
      const mapped = mapping[String(stage.id)];
      if (mapped && stage.state === "running") this.stations[mapped].state = "running";
      if (mapped === "bridge" && stage.state === "completed") this.stations.bridge.state = "completed";
      if (stage.id === "target_reimport" && stage.state === "skipped") {
        this.stations.output.state = "skipped";
        this.stations.output.detail = caption(data.message, "Ausgabedatei erstellt · Vorschau nicht verfügbar");
      }
    }
    if (["blocked", "failed"].includes(String(payload.jobStatus))) {
      for (const station of Object.values(this.stations)) {
        if (["waiting", "running"].includes(station.state)) {
          station.state = "failed";
          station.detail = caption(record(data.error).message, "Verarbeitung angehalten");
        }
      }
    }
    this.relayout();
  }

  private relayout() {
    this.sourceBounds.makeEmpty();
    for (const station of Object.values(this.stations)) this.sourceBounds.union(station.bounds);
    this.layout = cadStationLayout(this.sourceBounds);
    const {width, depth, origin, offsets} = this.layout;
    CAD_STATIONS.forEach((phase, index) => {
      const station = this.stations[phase];
      station.group.position.x = offsets[index];
      station.content.position.copy(origin);
      station.plate.scale.set(width, 0.08, depth);
      if (station.label) {
        const title = document.createElement("strong"), detail = document.createElement("small");
        title.textContent = `${String(index + 1).padStart(2, "0")}  ${station.title}`;
        const states: Record<string, string> = {waiting:"Wartet",running:"In Arbeit",completed:"Fertig",skipped:"Keine Vorschau",failed:"Angehalten"};
        detail.textContent = `${states[station.state]} · ${station.detail}`;
        station.label.dataset.state = station.state;
        station.label.replaceChildren(title, detail);
      }
    });
    this.root.updateMatrixWorld(true);
    this.bounds.setFromObject(this.root, true);
    // Leave space in the shared camera framing for the labels on the ground.
    this.bounds.max.z += Math.max(2, depth * 0.22);
  }

  renderLabels(camera: THREE.Camera, width: number, height: number) {
    if (!this.root.visible) return;
    for (const station of Object.values(this.stations)) if (station.label) {
      const p = new THREE.Vector3(station.group.position.x, 0.15, this.layout.depth * 0.56).project(camera);
      station.label.hidden = p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.15 || Math.abs(p.y) > 1.15;
      station.label.style.left = `${(p.x * 0.5 + 0.5) * width}px`;
      station.label.style.top = `${(-p.y * 0.5 + 0.5) * height}px`;
    }
  }

  snapshot() {
    return CAD_STATIONS.map((phase) => ({phase, state:this.stations[phase].state,
      objects:this.stations[phase].objects.size, vertices:this.stations[phase].vertices,
      offset:this.stations[phase].group.position.toArray(),
      origin:this.stations[phase].content.position.toArray(),
      rejected:this.stations[phase].rejected}));
  }

  destroy() {
    this.clear();
    for (const station of Object.values(this.stations)) {
      station.label?.remove();
      disposePreviewObject(station.plate);
    }
    this.root.removeFromParent();
  }
}

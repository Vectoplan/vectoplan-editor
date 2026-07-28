import * as THREE from "three";
import type {
  RealtimeMember,
  RealtimePresenceState,
} from "./realtime_client";

interface AvatarRig {
  readonly member: RealtimeMember;
  readonly root: THREE.Group;
  readonly leftArm: THREE.Mesh;
  readonly rightArm: THREE.Mesh;
  readonly leftLeg: THREE.Mesh;
  readonly rightLeg: THREE.Mesh;
  readonly targetPosition: THREE.Vector3;
  readonly targetVelocity: THREE.Vector3;
  readonly materials: THREE.Material[];
  readonly textures: THREE.Texture[];
  targetYaw: number;
  movementMode: RealtimePresenceState["movementMode"];
  phase: number;
  lastUpdateAtMs: number;
}

export interface RemoteAvatarScene {
  upsertMember(member: RealtimeMember): void;
  applyPresence(state: RealtimePresenceState): void;
  remove(sessionId: string): void;
  update(deltaSeconds: number, nowMs: number): void;
  clear(): void;
  getCount(): number;
  destroy(): void;
}

const AVATAR_HEIGHT = 1.95;
const STALE_AVATAR_MS = 30_000;

function createBox(
  name: string,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function createNameplate(displayName: string): {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    roundedRect(context, 12, 14, 488, 100, 28);
    context.fillStyle = "rgba(8, 14, 22, 0.78)";
    context.fill();
    context.strokeStyle = "rgba(255, 255, 255, 0.28)";
    context.lineWidth = 3;
    context.stroke();
    context.font = "600 42px Inter, Segoe UI, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(0,0,0,.8)";
    context.shadowBlur = 8;
    context.fillText(displayName.slice(0, 48), 256, 65, 450);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = "vectoplan-remote-avatar-name";
  sprite.position.set(0, AVATAR_HEIGHT + 0.42, 0);
  sprite.scale.set(2.4, 0.6, 1);
  sprite.renderOrder = 10_000;
  return { sprite, material, texture };
}

function safeColor(value: string): THREE.Color {
  const color = new THREE.Color(0x3b82f6);
  try {
    color.setStyle(value);
  } catch {
    // Keep the deterministic blue fallback.
  }
  return color;
}

function createRig(member: RealtimeMember): AvatarRig {
  const root = new THREE.Group();
  root.name = `vectoplan-remote-avatar:${member.sessionId}`;
  root.userData.vectoplanRemoteAvatar = true;
  root.userData.sessionId = member.sessionId;

  const primary = safeColor(member.avatarColor);
  const shirtMaterial = new THREE.MeshStandardMaterial({
    color: primary,
    roughness: 0.72,
    metalness: 0.02,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8a47f,
    roughness: 0.85,
    metalness: 0,
  });
  const trouserMaterial = new THREE.MeshStandardMaterial({
    color: primary.clone().multiplyScalar(0.52),
    roughness: 0.88,
    metalness: 0,
  });
  const shoeMaterial = new THREE.MeshStandardMaterial({
    color: 0x172033,
    roughness: 0.92,
    metalness: 0,
  });

  const torso = createBox("torso", [0.62, 0.72, 0.3], [0, 1.26, 0], shirtMaterial);
  const head = createBox("head", [0.46, 0.46, 0.46], [0, 1.85, 0], skinMaterial);
  const leftArm = createBox("left-arm", [0.2, 0.7, 0.22], [-0.43, 1.27, 0], shirtMaterial);
  const rightArm = createBox("right-arm", [0.2, 0.7, 0.22], [0.43, 1.27, 0], shirtMaterial);
  const leftLeg = createBox("left-leg", [0.25, 0.72, 0.27], [-0.17, 0.52, 0], trouserMaterial);
  const rightLeg = createBox("right-leg", [0.25, 0.72, 0.27], [0.17, 0.52, 0], trouserMaterial);
  const leftShoe = createBox("left-shoe", [0.27, 0.18, 0.38], [-0.17, 0.11, -0.04], shoeMaterial);
  const rightShoe = createBox("right-shoe", [0.27, 0.18, 0.38], [0.17, 0.11, -0.04], shoeMaterial);
  const nameplate = createNameplate(member.displayName);

  root.add(
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    leftShoe,
    rightShoe,
    nameplate.sprite,
  );

  const rig: AvatarRig = {
    member,
    root,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    targetPosition: new THREE.Vector3(),
    targetVelocity: new THREE.Vector3(),
    targetYaw: 0,
    movementMode: "airborne",
    phase: Math.random() * Math.PI * 2,
    lastUpdateAtMs: performance.now(),
    materials: [shirtMaterial, skinMaterial, trouserMaterial, shoeMaterial, nameplate.material],
    textures: [nameplate.texture],
  };

  if (member.state) {
    rig.targetPosition.set(member.state.position.x, member.state.position.y, member.state.position.z);
    rig.root.position.copy(rig.targetPosition);
    rig.targetYaw = member.state.yaw;
    rig.root.rotation.y = member.state.yaw;
  }
  return rig;
}

export function createRemoteAvatarScene(parent: THREE.Object3D): RemoteAvatarScene {
  const root = new THREE.Group();
  root.name = "vectoplan-remote-avatars";
  parent.add(root);
  const avatars = new Map<string, AvatarRig>();

  function remove(sessionId: string): void {
    const rig = avatars.get(sessionId);
    if (!rig) {
      return;
    }
    avatars.delete(sessionId);
    root.remove(rig.root);
    rig.root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
      }
    });
    rig.materials.forEach((material) => material.dispose());
    rig.textures.forEach((texture) => texture.dispose());
  }

  function upsertMember(member: RealtimeMember): void {
    if (avatars.has(member.sessionId)) {
      if (member.state) {
        applyPresence(member.state);
      }
      return;
    }
    const rig = createRig(member);
    avatars.set(member.sessionId, rig);
    root.add(rig.root);
  }

  function applyPresence(state: RealtimePresenceState): void {
    let rig = avatars.get(state.sessionId);
    if (!rig) {
      upsertMember({
        sessionId: state.sessionId,
        userId: state.userId,
        displayName: state.displayName,
        avatarColor: state.avatarColor,
        projectId: "",
        worldId: "",
        connectedAtMs: Date.now(),
        state,
      });
      rig = avatars.get(state.sessionId);
    }
    if (!rig) {
      return;
    }
    rig.targetPosition.set(state.position.x, state.position.y, state.position.z);
    rig.targetVelocity.set(state.velocity.x, state.velocity.y, state.velocity.z);
    rig.targetYaw = state.yaw;
    rig.movementMode = state.movementMode;
    rig.lastUpdateAtMs = performance.now();
  }

  return {
    upsertMember,
    applyPresence,
    remove,
    update(deltaSeconds, nowMs): void {
      const blend = 1 - Math.exp(-Math.max(0, deltaSeconds) * 12);
      for (const [sessionId, rig] of avatars) {
        if (nowMs - rig.lastUpdateAtMs > STALE_AVATAR_MS) {
          remove(sessionId);
          continue;
        }
        rig.root.position.lerp(rig.targetPosition, blend);
        rig.root.rotation.y = THREE.MathUtils.lerp(rig.root.rotation.y, rig.targetYaw, blend);

        const horizontalSpeed = Math.hypot(rig.targetVelocity.x, rig.targetVelocity.z);
        rig.phase += deltaSeconds * Math.max(2.5, horizontalSpeed * 5.5);
        const stride = rig.movementMode === "grounded"
          ? Math.sin(rig.phase) * Math.min(0.78, horizontalSpeed * 0.32)
          : 0.18;
        rig.leftLeg.rotation.x = stride;
        rig.rightLeg.rotation.x = -stride;
        rig.leftArm.rotation.x = -stride * 0.82;
        rig.rightArm.rotation.x = stride * 0.82;
      }
    },
    clear(): void {
      [...avatars.keys()].forEach(remove);
    },
    getCount: () => avatars.size,
    destroy(): void {
      [...avatars.keys()].forEach(remove);
      parent.remove(root);
    },
  };
}

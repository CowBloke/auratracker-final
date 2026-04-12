import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { X } from 'lucide-react';

export type LootCrateTier = 'wood' | 'iron' | 'gold' | 'diamond' | 'emerald' | 'ruby';

interface LootCrateOverlayProps {
  open: boolean;
  onClose: () => void;
  tier?: LootCrateTier;
  itemName?: string;
  itemColor?: string;
  itemImage?: string | null;
}

type AnimationPhase = 'idle' | 'dropping' | 'idle_landed' | 'opening' | 'revealing';

const TIER_CONFIG: Record<
  LootCrateTier,
  {
    plank: number;
    plankAlt: number;
    metal: number;
    nail: number;
    glow: number;
    rarity: string;
  }
> = {
  wood: { plank: 0x8b5a2b, plankAlt: 0xa06a35, metal: 0x3a3a42, nail: 0x888888, glow: 0xffe08a, rarity: 'Common' },
  iron: { plank: 0x7a7d85, plankAlt: 0x9095a0, metal: 0x2a2d33, nail: 0xbfc3cc, glow: 0xcfd6e0, rarity: 'Uncommon' },
  gold: { plank: 0xd4a017, plankAlt: 0xf2c14e, metal: 0x8a5a00, nail: 0xfff2a8, glow: 0xffe066, rarity: 'Rare' },
  diamond: { plank: 0x9fe8ff, plankAlt: 0xd6f5ff, metal: 0x3a8ab0, nail: 0xffffff, glow: 0xbaf0ff, rarity: 'Epic' },
  emerald: { plank: 0x2ecc71, plankAlt: 0x5ee396, metal: 0x145a34, nail: 0xb8f5d0, glow: 0x7cffb0, rarity: 'Legendary' },
  ruby: { plank: 0xd9304b, plankAlt: 0xf25a72, metal: 0x6b0e1c, nail: 0xffb8c2, glow: 0xff6080, rarity: 'Mythic' },
};

function disposeMaterial(material: THREE.Material) {
  const textureKeys = ['map', 'alphaMap', 'aoMap', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
  const candidate = material as THREE.Material & Record<string, THREE.Texture | null | undefined>;

  textureKeys.forEach((key) => {
    const texture = candidate[key];
    if (texture) texture.dispose();
  });

  material.dispose();
}

function disposeGroup(group: THREE.Object3D) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(mesh.material);
      }
    }
  });
}

function makeLabel(text: string, tint: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
  }

  context.fillStyle = 'rgba(0,0,0,0.65)';
  const radius = 18;
  const width = canvas.width - 40;
  const height = canvas.height - 40;
  const padX = 20;
  const padY = 20;

  context.beginPath();
  context.moveTo(padX + radius, padY);
  context.lineTo(padX + width - radius, padY);
  context.quadraticCurveTo(padX + width, padY, padX + width, padY + radius);
  context.lineTo(padX + width, padY + height - radius);
  context.quadraticCurveTo(padX + width, padY + height, padX + width - radius, padY + height);
  context.lineTo(padX + radius, padY + height);
  context.quadraticCurveTo(padX, padY + height, padX, padY + height - radius);
  context.lineTo(padX, padY + radius);
  context.quadraticCurveTo(padX, padY, padX + radius, padY);
  context.closePath();
  context.fill();

  context.strokeStyle = `#${tint.toString(16).padStart(6, '0')}`;
  context.lineWidth = 3;
  context.stroke();

  context.font = 'bold 44px system-ui,sans-serif';
  context.fillStyle = '#fff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.scale.set(2.4, 0.6, 1);
  sprite.position.y = 1.1;
  return sprite;
}

const easeOutBack = (value: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(value - 1, 3) + c1 * Math.pow(value - 1, 2);
};

const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

export default function LootCrateOverlay({
  open,
  onClose,
  tier = 'wood',
  itemName,
  itemColor,
  itemImage,
}: LootCrateOverlayProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);

  const crateGroupRef = useRef<THREE.Group | null>(null);
  const lidPivotRef = useRef<THREE.Group | null>(null);
  const itemGroupRef = useRef<THREE.Group | null>(null);
  const gemRef = useRef<THREE.Mesh | null>(null);
  const pngMeshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial | null>(null);

  const particlesRef = useRef<THREE.Mesh[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(performance.now());
  const imageTokenRef = useRef<string>('');

  const phaseRef = useRef<AnimationPhase>('idle');
  const phaseTimeRef = useRef(0);
  const lidAngleRef = useRef(0);
  const itemLiftRef = useRef(0);
  const clickToOpenRef = useRef(false);

  const onResize = () => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };

  const clearCurrentCrate = () => {
    const scene = sceneRef.current;
    const crateGroup = crateGroupRef.current;
    if (!scene || !crateGroup) return;

    scene.remove(crateGroup);
    disposeGroup(crateGroup);

    crateGroupRef.current = null;
    lidPivotRef.current = null;
    itemGroupRef.current = null;
    gemRef.current = null;
    pngMeshRef.current = null;
    glowMatRef.current = null;
    particlesRef.current = [];
  };

  const initScene = () => {
    if (rendererRef.current || !overlayRef.current) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.2, 6.5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));

    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(5, 8, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x99aaff, 0.3);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    overlayRef.current.appendChild(renderer.domElement);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    textureLoaderRef.current = new THREE.TextureLoader();

    onResize();
  };

  const buildCrate = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    clearCurrentCrate();

    const crateGroup = new THREE.Group();
    scene.add(crateGroup);
    crateGroupRef.current = crateGroup;

    const cfg = TIER_CONFIG[tier];

    const woodMat = new THREE.MeshStandardMaterial({ color: cfg.plank, flatShading: true, roughness: 0.9 });
    const woodAltMat = new THREE.MeshStandardMaterial({ color: cfg.plankAlt, flatShading: true, roughness: 0.9 });
    const metalMat = new THREE.MeshStandardMaterial({ color: cfg.metal, flatShading: true, roughness: 0.4, metalness: 0.75 });
    const nailMat = new THREE.MeshStandardMaterial({ color: cfg.nail, flatShading: true, roughness: 0.35, metalness: 0.85 });
    const insideMat = new THREE.MeshStandardMaterial({ color: 0x1a0f08, flatShading: true, roughness: 1, side: THREE.DoubleSide });
    const glowMat = new THREE.MeshBasicMaterial({ color: cfg.glow, transparent: true, opacity: 0 });
    glowMatRef.current = glowMat;

    const width = 2.2;
    const height = 1.5;
    const depth = 2.2;
    const thickness = 0.08;
    const baseY = -0.3;

    const createPlankWall = (wallWidth: number, wallHeight: number, wallDepth: number, axis: 'x' | 'z', plankCount: number) => {
      const group = new THREE.Group();
      const fullSpan = axis === 'x' ? wallWidth : wallDepth;
      const plankSpan = fullSpan / plankCount;

      for (let index = 0; index < plankCount; index += 1) {
        const geometry = axis === 'x'
          ? new THREE.BoxGeometry(plankSpan * 0.97, wallHeight, wallDepth)
          : new THREE.BoxGeometry(wallWidth, wallHeight, plankSpan * 0.97);
        const plank = new THREE.Mesh(geometry, index % 2 === 0 ? woodMat : woodAltMat);

        if (axis === 'x') {
          plank.position.x = (-wallWidth / 2) + (plankSpan / 2) + (index * plankSpan);
        } else {
          plank.position.z = (-wallDepth / 2) + (plankSpan / 2) + (index * plankSpan);
        }

        group.add(plank);
      }

      return group;
    };

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, depth), woodMat);
    floor.position.set(0, baseY - (height / 2) + (thickness / 2), 0);
    crateGroup.add(floor);

    const frontWall = createPlankWall(width, height, thickness, 'x', 5);
    frontWall.position.set(0, baseY, (depth / 2) - (thickness / 2));
    crateGroup.add(frontWall);

    const backWall = createPlankWall(width, height, thickness, 'x', 5);
    backWall.position.set(0, baseY, (-depth / 2) + (thickness / 2));
    crateGroup.add(backWall);

    const leftWall = createPlankWall(thickness, height, depth - (thickness * 2), 'z', 5);
    leftWall.position.set((-width / 2) + (thickness / 2), baseY, 0);
    crateGroup.add(leftWall);

    const rightWall = createPlankWall(thickness, height, depth - (thickness * 2), 'z', 5);
    rightWall.position.set((width / 2) - (thickness / 2), baseY, 0);
    crateGroup.add(rightWall);

    const innerWidth = width - (thickness * 2.2);
    const innerDepth = depth - (thickness * 2.2);
    const innerHeight = height - (thickness * 1.1);

    const innerFloor = new THREE.Mesh(new THREE.BoxGeometry(innerWidth, 0.02, innerDepth), insideMat);
    innerFloor.position.set(0, baseY - (height / 2) + thickness + 0.01, 0);
    crateGroup.add(innerFloor);

    ['north', 'south', 'east', 'west'].forEach((side) => {
      const northSouth = side === 'north' || side === 'south';
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(northSouth ? innerWidth : innerDepth, innerHeight), insideMat);

      if (side === 'north') panel.position.set(0, baseY + 0.05, -innerDepth / 2);
      if (side === 'south') {
        panel.position.set(0, baseY + 0.05, innerDepth / 2);
        panel.rotation.y = Math.PI;
      }
      if (side === 'east') {
        panel.position.set(innerWidth / 2, baseY + 0.05, 0);
        panel.rotation.y = -Math.PI / 2;
      }
      if (side === 'west') {
        panel.position.set(-innerWidth / 2, baseY + 0.05, 0);
        panel.rotation.y = Math.PI / 2;
      }

      crateGroup.add(panel);
    });

    [-width / 2, width / 2].forEach((x) => {
      [-depth / 2, depth / 2].forEach((z) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, height + 0.02, 0.1), metalMat);
        post.position.set(x, baseY, z);
        crateGroup.add(post);
      });
    });

    [baseY + (height / 2) - 0.06, baseY - (height / 2) + 0.06].forEach((yPos) => {
      const frontBand = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.08, 0.08), metalMat);
      frontBand.position.set(0, yPos, depth / 2);
      crateGroup.add(frontBand);

      const backBand = frontBand.clone();
      backBand.position.z = -depth / 2;
      crateGroup.add(backBand);

      const rightBand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, depth + 0.02), metalMat);
      rightBand.position.set(width / 2, yPos, 0);
      crateGroup.add(rightBand);

      const leftBand = rightBand.clone();
      leftBand.position.x = -width / 2;
      crateGroup.add(leftBand);
    });

    const nailGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 6);
    [-1, 1].forEach((side) => {
      for (let index = 0; index < 4; index += 1) {
        [baseY + (height / 2) - 0.06, baseY - (height / 2) + 0.06].forEach((yPos) => {
          const nail = new THREE.Mesh(nailGeometry, nailMat);
          nail.rotation.x = Math.PI / 2;
          nail.position.set((-width / 2) + 0.25 + (index * (width - 0.5)) / 3, yPos, side * ((depth / 2) + 0.04));
          crateGroup.add(nail);
        });
      }
    });

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, baseY + (height / 2), (-depth / 2) + (thickness / 2));
    crateGroup.add(lidPivot);
    lidPivotRef.current = lidPivot;

    const lidHeight = 0.18;
    const lidGroup = new THREE.Group();
    for (let index = 0; index < 5; index += 1) {
      const plankDepth = depth / 5;
      const lidPlank = new THREE.Mesh(
        new THREE.BoxGeometry(width, lidHeight, plankDepth * 0.96),
        index % 2 === 0 ? woodMat : woodAltMat,
      );
      lidPlank.position.z = (plankDepth / 2) + (index * plankDepth) - (thickness / 2);
      lidGroup.add(lidPlank);
    }

    const strapA = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.05, 0.18), metalMat);
    strapA.position.set(0, (lidHeight / 2) + 0.02, (depth / 2) - 0.3);
    lidGroup.add(strapA);

    const strapB = strapA.clone();
    strapB.position.z = 0.3;
    lidGroup.add(strapB);

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.08), metalMat);
    lock.position.set(0, (lidHeight / 2) + 0.02, depth - thickness - 0.15);
    lidGroup.add(lock);

    [(-width / 2) + 0.35, (width / 2) - 0.35].forEach((x) => {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), metalMat);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.set(x, 0, 0);
      lidPivot.add(hinge);
    });

    lidPivot.add(lidGroup);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = baseY - (height / 2) + thickness + 0.03;
    crateGroup.add(glow);

    const revealItem = new THREE.Group();
    revealItem.visible = false;
    revealItem.position.y = baseY;
    crateGroup.add(revealItem);
    itemGroupRef.current = revealItem;

    const resolvedItemColor = itemColor ?? '#56e0ff';
    const gemMaterial = new THREE.MeshStandardMaterial({
      color: resolvedItemColor,
      flatShading: true,
      emissive: new THREE.Color(resolvedItemColor).multiplyScalar(0.25),
      roughness: 0.3,
      metalness: 0.4,
    });
    const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), gemMaterial);
    revealItem.add(gem);
    gemRef.current = gem;

    const imageMaterial = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, side: THREE.DoubleSide });
    const imagePlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), imageMaterial);
    imagePlane.visible = false;
    revealItem.add(imagePlane);
    pngMeshRef.current = imagePlane;

    const itemLabel = makeLabel(`${itemName ?? 'Mystery Item'} · ${cfg.rarity.toUpperCase()}`, cfg.glow);
    revealItem.add(itemLabel);

    crateGroup.position.set(0, 8, 0);
    crateGroup.rotation.set(-0.3, 0.6, 0.15);
  };

  const spawnParticles = () => {
    const crateGroup = crateGroupRef.current;
    if (!crateGroup) return;

    const geometry = new THREE.TetrahedronGeometry(0.14, 0);
    const glowColor = new THREE.Color(TIER_CONFIG[tier].glow);

    for (let index = 0; index < 70; index += 1) {
      const mixColor = Math.random() < 0.5
        ? glowColor
        : new THREE.Color().setHSL(Math.random(), 0.75, 0.6);

      const particle = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: mixColor,
          flatShading: true,
          emissive: mixColor.clone().multiplyScalar(0.4),
          transparent: true,
        }),
      );

      particle.position.set(0, -0.1, 0);
      crateGroup.add(particle);

      const angle = Math.random() * Math.PI * 2;
      const upVelocity = 2.8 + (Math.random() * 3);
      const radiusVelocity = 2 + (Math.random() * 2.5);

      particle.userData = {
        vel: new THREE.Vector3(Math.cos(angle) * radiusVelocity, upVelocity, Math.sin(angle) * radiusVelocity),
        rot: new THREE.Vector3((Math.random() * 6) - 3, (Math.random() * 6) - 3, (Math.random() * 6) - 3),
        life: 1.8,
        maxLife: 1.8,
      };

      particlesRef.current.push(particle);
    }
  };

  const startLoop = () => {
    if (rafRef.current) return;

    const animate = (now: number) => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const overlay = overlayRef.current;
      const crateGroup = crateGroupRef.current;
      const lidPivot = lidPivotRef.current;
      const itemGroup = itemGroupRef.current;
      const glowMat = glowMatRef.current;
      const gem = gemRef.current;
      const pngMesh = pngMeshRef.current;

      if (!renderer || !scene || !camera || !overlay || !crateGroup || !lidPivot || !itemGroup || !glowMat || !gem || !pngMesh) {
        rafRef.current = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = Math.min((now - lastFrameRef.current) / 1000, 0.1);
      lastFrameRef.current = now;
      phaseTimeRef.current += deltaTime;

      const fade = Math.min(phaseTimeRef.current / 0.4, 1);
      overlay.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,${0.55 * fade}) 0%, rgba(0,0,0,${0.9 * fade}) 100%)`;

      if (phaseRef.current === 'dropping') {
        const duration = 0.9;
        const k = Math.min(phaseTimeRef.current / duration, 1);
        const eased = easeOutBack(k);
        crateGroup.position.y = 8 * (1 - eased);

        const targetRotX = -0.25;
        const targetRotY = 0.55;
        const targetRotZ = 0.08;
        const rotationBlend = easeOutCubic(k);

        crateGroup.rotation.x = -0.3 + ((targetRotX + 0.3) * rotationBlend) + (Math.sin(phaseTimeRef.current * 8) * 0.05 * (1 - k));
        crateGroup.rotation.y = 0.6 + ((targetRotY - 0.6) * rotationBlend);
        crateGroup.rotation.z = 0.15 + ((targetRotZ - 0.15) * rotationBlend);

        if (k >= 1) {
          phaseRef.current = 'idle_landed';
          clickToOpenRef.current = true;
          phaseTimeRef.current = 0;
        }
      } else if (phaseRef.current === 'idle_landed') {
        crateGroup.position.y = Math.sin(phaseTimeRef.current * 2) * 0.05;
        crateGroup.rotation.y = 0.55 + (Math.sin(phaseTimeRef.current * 1.2) * 0.04);
      } else if (phaseRef.current === 'opening') {
        lidAngleRef.current = Math.min(lidAngleRef.current + (deltaTime * 2.4), Math.PI * 0.7);
        lidPivot.rotation.x = -lidAngleRef.current;
        glowMat.opacity = Math.min(glowMat.opacity + (deltaTime * 1.2), 0.85);
        crateGroup.position.y = Math.sin(phaseTimeRef.current * 2) * 0.05;

        if (lidAngleRef.current >= Math.PI * 0.7) {
          phaseRef.current = 'revealing';
          itemGroup.visible = true;
          if (itemImage && pngMesh.userData.ready) {
            pngMesh.visible = true;
            gem.visible = false;
          }
        }
      } else if (phaseRef.current === 'revealing') {
        itemLiftRef.current = Math.min(itemLiftRef.current + (deltaTime * 1.1), 1.7);
        itemGroup.position.y = -0.3 + itemLiftRef.current;

        gem.rotation.y += deltaTime * 1.4;
        gem.rotation.x += deltaTime * 0.6;

        const bob = Math.sin(now * 0.002) * 0.08;
        gem.position.y = bob;
        pngMesh.position.y = bob;

        if (pngMesh.visible) {
          const worldPosition = new THREE.Vector3();
          pngMesh.getWorldPosition(worldPosition);
          pngMesh.lookAt(camera.position.x, worldPosition.y, camera.position.z);
        }

        glowMat.opacity = 0.75 + (Math.sin(now * 0.004) * 0.1);
        crateGroup.position.y = Math.sin(phaseTimeRef.current * 2) * 0.04;
      }

      for (let index = particlesRef.current.length - 1; index >= 0; index -= 1) {
        const particle = particlesRef.current[index];
        particle.userData.life -= deltaTime;
        particle.userData.vel.y -= 6 * deltaTime;
        particle.position.addScaledVector(particle.userData.vel, deltaTime);

        particle.rotation.x += particle.userData.rot.x * deltaTime;
        particle.rotation.y += particle.userData.rot.y * deltaTime;
        particle.rotation.z += particle.userData.rot.z * deltaTime;

        const meshMat = particle.material as THREE.MeshStandardMaterial;
        meshMat.opacity = Math.max(0, particle.userData.life / particle.userData.maxLife);

        if (particle.userData.life <= 0) {
          crateGroup.remove(particle);
          particlesRef.current.splice(index, 1);
        }
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(animate);
    };

    lastFrameRef.current = performance.now();
    rafRef.current = requestAnimationFrame(animate);
  };

  const stopLoop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      stopLoop();
      clearCurrentCrate();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      textureLoaderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      phaseRef.current = 'idle';
      clickToOpenRef.current = false;
      stopLoop();
      if (overlayRef.current) overlayRef.current.style.background = 'transparent';
      return;
    }

    initScene();
    buildCrate();

    if (itemImage && textureLoaderRef.current && pngMeshRef.current) {
      imageTokenRef.current = `${Date.now()}-${itemImage}`;
      const activeToken = imageTokenRef.current;

      textureLoaderRef.current.load(itemImage, (texture) => {
        if (imageTokenRef.current !== activeToken || !pngMeshRef.current) {
          texture.dispose();
          return;
        }

        texture.magFilter = THREE.NearestFilter;

        const image = texture.image as { width: number; height: number };
        const aspect = image.width / image.height;
        const scale = 1.4;

        pngMeshRef.current.geometry.dispose();
        pngMeshRef.current.geometry = new THREE.PlaneGeometry(scale * aspect, scale);
        pngMeshRef.current.material.map = texture;
        pngMeshRef.current.material.needsUpdate = true;
        pngMeshRef.current.userData.ready = true;
      });
    }

    phaseRef.current = 'dropping';
    phaseTimeRef.current = 0;
    lidAngleRef.current = 0;
    itemLiftRef.current = 0;
    clickToOpenRef.current = false;

    startLoop();
  }, [open, tier, itemName, itemColor, itemImage]);

  const handleOverlayClick = () => {
    if (!open) return;
    if (clickToOpenRef.current && phaseRef.current === 'idle_landed') {
      clickToOpenRef.current = false;
      phaseRef.current = 'opening';
      spawnParticles();
    }
  };

  const handleCloseClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[120] ${open ? 'block' : 'hidden'}`}
      onClick={handleOverlayClick}
    >
      <button
        type="button"
        onClick={handleCloseClick}
        className="absolute right-5 top-5 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white transition-colors hover:bg-black/75"
        aria-label="Close loot crate animation"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="pointer-events-none absolute inset-x-0 top-8 z-20 text-center text-xs uppercase tracking-[0.24em] text-amber-100/85">
        Cliquez pour ouvrir
      </div>
    </div>
  );
}
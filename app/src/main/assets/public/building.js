import * as THREE from "./vendor/three.module.js";
import { gsap } from "./vendor/gsap/index.js";

const GOLD = 0xd7b76d;
const WARM = 0xffd69a;

function litMaterial(color, intensity = 1.8) {
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.15 });
  material.userData.litIntensity = intensity;
  material.emissiveIntensity = 0;
  return material;
}

function addBox(parent, geometry, material, position, group = parent) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// Place a repeatable grid of glass panels on the front and side faces.
function addWindowGrid(group, width, depth, floors, floorHeight) {
  const windowGeometry = new THREE.BoxGeometry(0.29, 0.48, 0.045);
  const mullionGeometry = new THREE.BoxGeometry(0.34, 0.035, 0.07);
  const columns = 10;
  const spacing = width / (columns + 1);
  const glassMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x152a3a, roughness: 0.17, metalness: 0.68, emissive: 0xffbd6b, emissiveIntensity: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x102334, roughness: 0.2, metalness: 0.62, emissive: 0xffdfab, emissiveIntensity: 0 }),
    new THREE.MeshStandardMaterial({ color: 0x0c1c2a, roughness: 0.18, metalness: 0.72, emissive: 0x9bc8df, emissiveIntensity: 0 }),
  ];
  glassMaterials.forEach((material) => { material.userData.litIntensity = 0.85; });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x314454, metalness: 0.7, roughness: 0.32 });

  for (let floor = 0; floor < floors; floor += 1) {
    const y = floor * floorHeight + floorHeight * 0.53;
    for (let column = 0; column < columns; column += 1) {
      const material = glassMaterials[Math.random() < 0.57 ? 0 : (Math.random() < 0.6 ? 1 : 2)];
      const frontWindow = new THREE.Mesh(windowGeometry, material);
      frontWindow.position.set(-width / 2 + spacing * (column + 1), y, depth / 2 + 0.025);
      group.add(frontWindow);
      const sideWindow = new THREE.Mesh(windowGeometry, material);
      sideWindow.rotation.y = Math.PI / 2;
      sideWindow.position.set(width / 2 + 0.025, y, -depth / 2 + spacing * (column + 1));
      group.add(sideWindow);
    }
    if (floor % 2 === 0) {
      const band = new THREE.Mesh(mullionGeometry, trimMaterial);
      band.position.set(0, floor * floorHeight + 0.04, depth / 2 + 0.04);
      group.add(band);
    }
  }
}

// Keep structure, interior lights, facade LEDs, and crown lights independently controllable.
function createTower(scene, { name, x, floors, floorHeight, width, depth, roofHeight }) {
  const root = new THREE.Group();
  root.name = `${name} architecture`;
  root.position.x = x;
  scene.add(root);

  const structureMaterial = new THREE.MeshStandardMaterial({ color: 0x1a2934, roughness: 0.29, metalness: 0.62 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: 0x142a39, roughness: 0.16, metalness: 0.74, emissive: 0x102638, emissiveIntensity: 0.32 });
  const height = floors * floorHeight;
  addBox(root, new THREE.BoxGeometry(width, height, depth), glassMaterial, [0, height / 2 + 0.2, 0]);

  for (let floor = 0; floor <= floors; floor += 3) {
    const y = floor * floorHeight + 0.22;
    addBox(root, new THREE.BoxGeometry(width + 0.18, 0.11, depth + 0.16), structureMaterial, [0, y, 0]);
  }

  const lighting = new THREE.Group();
  lighting.name = `${name} interior lights`;
  root.add(lighting);
  addWindowGrid(lighting, width, depth, floors, floorHeight);

  const facade = new THREE.Group();
  facade.name = `${name} facade LEDs`;
  const verticalMaterial = litMaterial(0x70c9e3, 2.8);
  const horizontalMaterial = litMaterial(GOLD, 1.25);
  for (const side of [-1, 1]) {
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.055, height + 0.1, 0.06), verticalMaterial);
    vertical.position.set(side * (width / 2 + 0.055), height / 2 + 0.24, depth / 2 + 0.06);
    facade.add(vertical);
  }
  const topLine = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.06, 0.07), horizontalMaterial);
  topLine.position.set(0, height + 0.28, depth / 2 + 0.06);
  facade.add(topLine);
  root.add(facade);

  const crown = new THREE.Group();
  crown.name = `${name} crown terrace`;
  const crownMaterial = litMaterial(WARM, 2.4);
  const crownFrame = new THREE.Group();
  for (let beam = -2; beam <= 2; beam += 1) {
    addBox(crownFrame, new THREE.BoxGeometry(0.13, roofHeight, 0.14), structureMaterial, [beam * width / 5, height + roofHeight / 2 + 0.25, 0]);
  }
  for (let beam = 0; beam < 3; beam += 1) {
    addBox(crownFrame, new THREE.BoxGeometry(width + 0.2, 0.1, 0.14), crownMaterial, [0, height + roofHeight * (beam / 3) + 0.25, 0]);
  }
  addBox(crownFrame, new THREE.BoxGeometry(width * 0.72, 0.25, depth * 0.72), litMaterial(0xffe1ad, 1.4), [0, height + 0.36, 0]);
  crown.add(crownFrame);
  root.add(crown);

  const roof = addBox(root, new THREE.BoxGeometry(width + 0.38, 0.2, depth + 0.35), structureMaterial, [0, height + 0.18, 0]);
  roof.castShadow = false;
  return { root, lighting, facade, crown, height };
}

function makeTree(parent, x, z, scale = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.4 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x382e29, roughness: 1 }));
  trunk.position.set(x, 0.7 * scale, z);
  parent.add(trunk);
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(0.88 * scale, 1), new THREE.MeshStandardMaterial({ color: 0x10251f, roughness: 0.9 }));
  canopy.position.set(x, 1.75 * scale, z);
  canopy.scale.set(1, 1.25, 0.95);
  canopy.castShadow = true;
  parent.add(canopy);
  const uplight = new THREE.PointLight(0xe4b866, 2.4, 5.5, 2);
  uplight.position.set(x, 0.2 * scale, z + 0.55 * scale);
  uplight.userData.litIntensity = 2.4;
  uplight.intensity = 0;
  parent.add(uplight);
}

function makeCar(parent, color, x, z) {
  const car = new THREE.Group();
  car.position.set(x, 0.24, z);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, metalness: 0.72, roughness: 0.24 });
  addBox(car, new THREE.BoxGeometry(1.6, 0.38, 0.72), bodyMaterial, [0, 0.2, 0]);
  addBox(car, new THREE.BoxGeometry(0.88, 0.32, 0.58), new THREE.MeshStandardMaterial({ color: 0x162b39, metalness: 0.6, roughness: 0.18 }), [-0.08, 0.51, 0]);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x080b0e, roughness: 0.9 });
  for (const side of [-1, 1]) {
    for (const end of [-0.5, 0.5]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(end, 0.13, side * 0.34);
      car.add(wheel);
    }
  }
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.15), litMaterial(0xfff2c1, 2.8));
    headlight.position.set(0.82, 0.26, side * 0.22);
    car.add(headlight);
  }
  parent.add(car);
  return car;
}

// Add the road, planted areas, streetlights, clubhouse, and animated vehicles.
const FACADE_STYLES = [
  { wall: "#c9c2b4", glass: "#4d6f8c" },
  { wall: "#a8b3bd", glass: "#2f4f6b" },
  { wall: "#b97a5a", glass: "#3b4f5e" },
  { wall: "#e2ddd0", glass: "#5b7f9a" },
  { wall: "#8f9aa3", glass: "#38566f" },
];

// One tile = 4x4 windows; some windows are lit in the emissive map so night shows occupied floors.
function createFacadeTextures(style) {
  const size = 256;
  const cell = size / 4;
  const color = document.createElement("canvas");
  const glow = document.createElement("canvas");
  color.width = color.height = glow.width = glow.height = size;
  const c = color.getContext("2d");
  const g = glow.getContext("2d");
  c.fillStyle = style.wall;
  c.fillRect(0, 0, size, size);
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * cell + 10;
      const y = row * cell + 14;
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(x - 3, y - 3, cell - 14, cell - 22);
      c.fillStyle = style.glass;
      c.fillRect(x, y, cell - 20, cell - 28);
      c.fillStyle = "rgba(255,255,255,0.28)";
      c.fillRect(x, y, cell - 20, 8);
      if (Math.random() < 0.55) {
        g.fillStyle = Math.random() < 0.7 ? "#ffcf8a" : "#cfe6ff";
        g.fillRect(x, y, cell - 20, cell - 28);
      }
    }
  }
  const map = new THREE.CanvasTexture(color);
  const emissiveMap = new THREE.CanvasTexture(glow);
  [map, emissiveMap].forEach((texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
  });
  return { map, emissiveMap };
}

function createCityMaterials() {
  return FACADE_STYLES.map((style) => {
    const { map, emissiveMap } = createFacadeTextures(style);
    const material = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.15 });
    material.userData.isCity = true;
    return material;
  });
}

// Repeat the facade tile per world size so windows keep a constant real-world scale.
function scaleFacadeUVs(geometry, width, height, depth) {
  const tileW = 6;
  const tileH = 5.2;
  const uv = geometry.attributes.uv;
  const faceSizes = [[depth, height], [depth, height], null, null, [width, height], [width, height]];
  faceSizes.forEach((size, face) => {
    if (!size) return;
    for (let v = face * 4; v < face * 4 + 4; v += 1) {
      uv.setXY(v, uv.getX(v) * size[0] / tileW, uv.getY(v) * size[1] / tileH);
    }
  });
  return geometry;
}

function createEnvironment(scene) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 200), new THREE.MeshStandardMaterial({ color: 0x101a20, roughness: 0.94, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x10161b, roughness: 0.75, metalness: 0.18 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(110, 9), roadMaterial);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.015, 13);
  scene.add(road);
  const laneMaterial = litMaterial(0x9f8d62, 0.25);
  for (let x = -48; x <= 48; x += 7) {
    addBox(scene, new THREE.BoxGeometry(3.2, 0.018, 0.08), laneMaterial, [x, 0.03, 13]);
  }

  const cityMaterials = createCityMaterials();
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x6b7075, roughness: 0.9, metalness: 0.1 });
  const cityRoofs = [roofMaterial];
  for (let i = 0; i < 34; i += 1) {
    const width = 2.2 + Math.random() * 4;
    const height = 4 + Math.random() * 14;
    const depth = 2 + Math.random() * 3;
    const x = -53 + i * 3.2 + Math.random() * 1.5;
    const z = -17 - Math.random() * 15;
    const material = cityMaterials[Math.floor(Math.random() * cityMaterials.length)];
    const geometry = scaleFacadeUVs(new THREE.BoxGeometry(width, height, depth), width, height, depth);
    // Box face order: +x, -x, +y (roof), -y, +z, -z.
    const building = new THREE.Mesh(geometry, [material, material, roofMaterial, roofMaterial, material, material]);
    building.position.set(x, height / 2 - 0.1, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    const unit = new THREE.Mesh(new THREE.BoxGeometry(width * 0.35, 0.5 + Math.random() * 0.5, depth * 0.4), roofMaterial);
    unit.position.set(x + (Math.random() - 0.5) * width * 0.4, height - 0.1 + 0.4, z);
    unit.castShadow = true;
    scene.add(unit);
    if (height > 11 && Math.random() < 0.6) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), roofMaterial);
      antenna.position.set(x, height + 0.9, z);
      scene.add(antenna);
    }
  }

  const garden = new THREE.Group();
  garden.name = "Landscape lighting";
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x202a28, roughness: 0.92 });
  const path = new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 4.5), pathMaterial);
  path.position.set(0, 0.04, 7.4);
  garden.add(path);
  const pathEdgeMaterial = litMaterial(0xf0c978, 0.75);
  for (const side of [-1, 1]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(22, 0.035, 0.035), pathEdgeMaterial);
    line.position.set(0, 0.12, 7.4 + side * 1.9);
    garden.add(line);
  }
  for (let i = 0; i < 11; i += 1) {
    makeTree(garden, -12 + i * 2.4, 5.1 + (i % 2) * 1.1, 0.72 + (i % 3) * 0.12);
  }
  scene.add(garden);

  const streetlights = new THREE.Group();
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x52616a, metalness: 0.8, roughness: 0.34 });
  for (const x of [-19, -11, 11, 19]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 5.8, 8), poleMaterial);
    pole.position.set(x, 2.9, 10.6);
    streetlights.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.24), litMaterial(WARM, 1.8));
    head.position.set(x, 5.82, 10.6);
    streetlights.add(head);
    const light = new THREE.PointLight(0xffd68e, 3.5, 12, 2);
    light.position.set(x, 5.5, 10.6);
    light.userData.litIntensity = 3.5;
    light.intensity = 0;
    streetlights.add(light);
  }
  garden.add(streetlights);

  const clubhouse = new THREE.Group();
  clubhouse.name = "Clubhouse lighting";
  const stone = new THREE.MeshStandardMaterial({ color: 0x465054, roughness: 0.52, metalness: 0.22 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x183241, roughness: 0.16, metalness: 0.72, emissive: 0xf3bd79, emissiveIntensity: 0 });
  glass.userData.litIntensity = 1.6;
  const building = new THREE.Mesh(new THREE.BoxGeometry(8.2, 2.8, 4.1), stone);
  building.position.set(9.2, 1.4, 5.5);
  clubhouse.add(building);
  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(7.7, 1.35, 0.06), glass);
  windowBand.position.set(9.2, 1.65, 7.58);
  clubhouse.add(windowBand);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.7, 0.2, 4.5), new THREE.MeshStandardMaterial({ color: 0x263740, metalness: 0.62, roughness: 0.35 }));
  roof.position.set(9.2, 2.85, 5.5);
  clubhouse.add(roof);
  const clubhouseLed = new THREE.Mesh(new THREE.BoxGeometry(8.3, 0.045, 0.06), litMaterial(GOLD, 1.8));
  clubhouseLed.position.set(9.2, 2.78, 7.75);
  clubhouse.add(clubhouseLed);
  scene.add(clubhouse);

  const cars = new THREE.Group();
  cars.name = "Moving cars";
  const carOne = makeCar(cars, 0x8a9ba0, -22, 11.3);
  const carTwo = makeCar(cars, 0x8b6b46, 16, 14.5);
  scene.add(cars);
  return { garden, clubhouse, cars, carOne, carTwo, cityMaterials, ground };
}

// Assemble the complete scene and expose a small API for the HTML controls.
export function createBuilding(host) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x091624);
  scene.fog = new THREE.FogExp2(0x091624, 0.009);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 220);
  const initialCamera = new THREE.Vector3(24, 18, 43);
  const target = new THREE.Vector3(0, 8.4, 0);
  camera.position.copy(initialCamera);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  host.appendChild(renderer.domElement);

  const hemiLight = new THREE.HemisphereLight(0x8caec9, 0x111821, 1.25);
  scene.add(hemiLight);
  const moonLight = new THREE.DirectionalLight(0x9dbdd3, 2.1);
  moonLight.position.set(-18, 26, -10);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  scene.add(moonLight);
  const fillLight = new THREE.PointLight(0x4e89a4, 30, 70, 2);
  fillLight.position.set(20, 17, 18);
  scene.add(fillLight);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(130, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { topColor: { value: new THREE.Color(0x173757) }, bottomColor: { value: new THREE.Color(0x07111c) }, offset: { value: 10 }, exponent: { value: 0.72 } },
    vertexShader: "varying vec3 vWorldPosition; void main(){ vec4 worldPosition=modelMatrix*vec4(position,1.0); vWorldPosition=worldPosition.xyz; gl_Position=projectionMatrix*viewMatrix*worldPosition; }",
    fragmentShader: "uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent; varying vec3 vWorldPosition; void main(){ float h=normalize(vWorldPosition+vec3(0.0,offset,0.0)).y; gl_FragColor=vec4(mix(bottomColor,topColor,max(pow(max(h,0.0),exponent),0.0)),1.0); }",
    depthWrite: false,
  }));
  scene.add(sky);

  const starsGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 360; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 50 + Math.random() * 45;
    starPositions.push(Math.cos(angle) * radius, 15 + Math.random() * 48, Math.sin(angle) * radius - 30);
  }
  starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xa9c6d7, size: 0.12, transparent: true, opacity: 0.72 }));
  scene.add(stars);

  const towerA = createTower(scene, { name: "Tower A", x: -4.1, floors: 19, floorHeight: 1.02, width: 5.5, depth: 4.7, roofHeight: 2.7 });
  const towerB = createTower(scene, { name: "Tower B", x: 3.25, floors: 15, floorHeight: 1.02, width: 5.15, depth: 4.45, roofHeight: 2.3 });
  const environment = createEnvironment(scene);

  const groups = {
    towerA: towerA.lighting,
    towerB: towerB.lighting,
    landscape: environment.garden,
    clubhouse: environment.clubhouse,
    crown: [towerA.crown, towerB.crown],
    facade: [towerA.facade, towerB.facade],
    cars: environment.cars,
  };

  const ledMaterials = [];
  groups.facade.forEach((group) => group.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      if (!material.userData.litIntensity) return;
      material.userData.baseColor = material.color.clone();
      material.userData.baseEmissive = material.emissive.clone();
      ledMaterials.push(material);
    });
  }));

  const lightingKeys = ["towerA", "towerB", "landscape", "clubhouse", "crown", "facade"];
  const states = { towerA: true, towerB: true, landscape: true, clubhouse: true, crown: true, facade: true, cars: false, animation: false };
  const litMaterials = new Set();
  const litObjects = new Set();
  scene.traverse((object) => {
    if (object.isMesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!material.userData.litIntensity) return;
        if (!material.userData.baseEmissive) material.userData.baseEmissive = material.emissive.clone();
        litMaterials.add(material);
      });
    }
    if (object.isLight && object.userData.litIntensity) {
      object.userData.baseLightColor = object.color.clone();
      litObjects.add(object);
    }
  });
  const clock = new THREE.Clock();
  let frameId = 0;
  let drag = null;
  let yaw = 0.51;
  let pitch = 0.2;
  let targetYaw = 0.51;
  let targetPitch = 0.2;
  let distance = 51;
  let targetDistance = 51;
  let disposed = false;
  let brightness = 1;
  let lightColor = null;

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function updateCamera() {
    const horizontal = Math.cos(pitch) * distance;
    camera.position.set(target.x + Math.sin(yaw) * horizontal, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * horizontal);
    camera.lookAt(target);
  }

  // Tween emissive materials and point lights without changing their geometry.
  function toggleGroup(group, enabled) {
    const roots = Array.isArray(group) ? group : [group];
    roots.forEach((root) => root.traverse((object) => {
      if (object.isMesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (material.userData.litIntensity) gsap.to(material, { emissiveIntensity: enabled ? material.userData.litIntensity * brightness : 0, duration: 0.65, ease: "power2.out", overwrite: true });
        });
      }
      if (object.isLight && object.userData.litIntensity) gsap.to(object, { intensity: enabled ? object.userData.litIntensity * brightness : 0, duration: 0.7, ease: "power2.out", overwrite: true });
    }));
  }

  function setSection(key, enabled) {
    if (!(key in states) || key === "animation") return;
    states[key] = enabled;
    if (key === "cars") {
      environment.cars.visible = enabled;
      return;
    }
    toggleGroup(groups[key], enabled);
  }

  function setAllLights(enabled) {
    lightingKeys.forEach((key) => setSection(key, enabled));
  }

  function setBrightness(value) {
    brightness = THREE.MathUtils.clamp(value, 0.25, 1.5);
    Object.entries(groups).forEach(([key, group]) => toggleGroup(group, Boolean(states[key])));
  }

  const nightLook = {
    background: 0x091624, fogDensity: 0.009, skyTop: 0x173757, skyBottom: 0x07111c,
    hemiSky: 0x8caec9, hemiGround: 0x111821, hemiIntensity: 1.25,
    sun: 0x9dbdd3, sunIntensity: 2.1, fill: 30, exposure: 1.28, stars: true,
  };
  const dayLook = {
    background: 0x9fd0f2, fogDensity: 0.0025, skyTop: 0x3d93e0, skyBottom: 0xd8eefc,
    hemiSky: 0xffffff, hemiGround: 0xc8d2c0, hemiIntensity: 5,
    sun: 0xfff4dc, sunIntensity: 7, fill: 0, exposure: 2.0, stars: false,
  };

  function setDaylight(enabled) {
    const look = enabled ? dayLook : nightLook;
    scene.background.set(look.background);
    scene.fog.color.set(look.background);
    scene.fog.density = look.fogDensity;
    sky.material.uniforms.topColor.value.set(look.skyTop);
    sky.material.uniforms.bottomColor.value.set(look.skyBottom);
    hemiLight.color.set(look.hemiSky);
    hemiLight.groundColor.set(look.hemiGround);
    hemiLight.intensity = look.hemiIntensity;
    moonLight.color.set(look.sun);
    moonLight.intensity = look.sunIntensity;
    fillLight.intensity = look.fill;
    renderer.toneMappingExposure = look.exposure;
    stars.visible = look.stars;
    environment.cityMaterials.forEach((material) => {
      material.color.setScalar(enabled ? 1 : 0.4);
      material.emissiveIntensity = enabled ? 0 : 0.9;
    });
    environment.ground.material.color.set(enabled ? 0x6f7a6a : 0x101a20);
  }

  function setLightColor(hex) {
    if (hex !== null && (typeof hex !== "string" || !/^#[\da-f]{6}$/i.test(hex))) {
      throw new TypeError("Light color must be a six-digit hexadecimal color or null.");
    }
    lightColor = hex;
    const selectedColor = hex ? new THREE.Color(hex) : null;
    litMaterials.forEach((material) => {
      material.emissive.copy(material.userData.baseEmissive);
      if (selectedColor) material.emissive.lerp(selectedColor, 0.78);
    });
    litObjects.forEach((object) => {
      object.color.copy(object.userData.baseLightColor);
      if (selectedColor) object.color.lerp(selectedColor, 0.78);
    });
  }

  lightingKeys.forEach((key) => toggleGroup(groups[key], true));

  function setAnimation(enabled) {
    states.animation = enabled;
    if (!enabled) {
      ledMaterials.forEach((material) => {
        material.color.copy(material.userData.baseColor);
        material.emissive.copy(material.userData.baseEmissive);
        gsap.to(material, { emissiveIntensity: states.facade ? material.userData.litIntensity * brightness : 0, duration: 0.55, ease: "power2.out", overwrite: true });
      });
      if (lightColor) setLightColor(lightColor);
    }
  }

  function setZoom(delta) {
    targetDistance = THREE.MathUtils.clamp(targetDistance + delta, 27, 78);
  }

  function resetView() {
    targetYaw = 0.51;
    targetPitch = 0.2;
    targetDistance = 51;
    gsap.to(target, { x: 0, y: 8.4, z: 0, duration: 0.7, ease: "power2.inOut", onUpdate: updateCamera });
  }

  function onPointerDown(event) {
    drag = { x: event.clientX, y: event.clientY, yaw: targetYaw, pitch: targetPitch };
    renderer.domElement.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    targetYaw = drag.yaw - (event.clientX - drag.x) * 0.004;
    targetPitch = THREE.MathUtils.clamp(drag.pitch + (event.clientY - drag.y) * 0.003, -0.05, 0.55);
  }

  function onPointerUp() { drag = null; }

  function onWheel(event) {
    event.preventDefault();
    setZoom(event.deltaY > 0 ? 2.5 : -2.5);
  }

  function animate() {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    yaw += (targetYaw - yaw) * 0.12;
    pitch += (targetPitch - pitch) * 0.12;
    distance += (targetDistance - distance) * 0.12;
    updateCamera();
    if (states.animation) {
      const hue = (0.52 + elapsed * 0.035) % 1;
      ledMaterials.forEach((material, index) => {
        material.color.setHSL(hue + index * 0.009, 0.58, 0.61);
        material.emissive.setHSL(hue + index * 0.009, 0.8, 0.58);
        material.emissiveIntensity = states.facade ? (2.3 + Math.sin(elapsed * 2.1 + index) * 0.55) * brightness : 0;
      });
    }
    if (states.cars) {
      environment.carOne.position.x = -22 + ((elapsed * 5.5) % 48);
      environment.carTwo.position.x = 23 - ((elapsed * 4.1) % 48);
    }
    renderer.render(scene, camera);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerup", onPointerUp);
  renderer.domElement.addEventListener("pointercancel", onPointerUp);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  updateCamera();
  animate();

  return {
    states,
    lightingKeys,
    setSection,
    setAllLights,
    setBrightness,
    setLightColor,
    setDaylight,
    setAnimation,
    setZoom,
    resetView,
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
    },
  };
}
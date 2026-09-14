import * as T from "three";
import { type GroundState, type Point } from "./proving-ground.ts";

const COLORS = {
  grass: 0x68745a,
  earth: 0x8a8069,
  leaf: 0x4e6846,
  trunk: 0x655342,
  wall: 0xc0b39a,
  roof: 0x696559,
  rubble: 0x8b8170,
  tank: 0x6a8060,
  metal: 0x343d36,
  accent: 0xb4d8b3,
};
function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function groundTexture(s: GroundState) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1536;
  const c = canvas.getContext("2d")!,
    size = 1536,
    unit = size / 120,
    rand = random(712);
  c.fillStyle = "#71795f";
  c.fillRect(0, 0, size, size);
  // World-space continuous material field. No visible grid of separate image tiles.
  for (let i = 0; i < 10000; i++) {
    const x = rand() * size,
      y = rand() * size,
      r = rand() * 17 + 2;
    c.fillStyle = i % 2 ? "rgba(32,47,26,.055)" : "rgba(210,191,135,.055)";
    c.beginPath();
    c.ellipse(x, y, r, r * 0.7, rand() * 6, 0, Math.PI * 2);
    c.fill();
  }
  const coord = (p: Point) => [(p.x + 60) * unit, (60 - p.y) * unit];
  c.lineCap = "round";
  c.lineJoin = "round";
  for (const r of s.layout.routes) {
    for (let shoulder = 3; shoulder >= 0; shoulder--) {
      c.beginPath();
      r.points.forEach((p, i) => {
        const [x, y] = coord(p);
        if (i) c.lineTo(x, y);
        else c.moveTo(x, y);
      });
      c.strokeStyle = shoulder ? "rgba(147,136,107,.20)" : "#a4987d";
      c.lineWidth = (r.width + shoulder * 1.2) * unit;
      c.stroke();
    }
    c.setLineDash([0.8 * unit, 1.8 * unit]);
    c.lineWidth = 0.16 * unit;
    c.strokeStyle = "rgba(69,60,44,.28)";
    c.stroke();
    c.setLineDash([]);
  }
  for (const p of s.layout.surfaces) {
    const [x, y] = coord(p);
    c.save();
    c.translate(x, y);
    c.scale(p.rx * unit, p.ry * unit);
    const g = c.createRadialGradient(0, 0, 0.2, 0, 0, 1.15);
    g.addColorStop(0, "#625c48");
    g.addColorStop(0.82, "#71684f");
    g.addColorStop(1, "rgba(113,104,79,0)");
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 1.15, 0, 7);
    c.fill();
    c.restore();
    c.strokeStyle = "rgba(44,41,30,.25)";
    c.lineWidth = 2;
    for (let i = 0; i < 35; i++) {
      const dx = (rand() - 0.5) * p.rx * unit * 1.4,
        dy = (rand() - 0.5) * p.ry * unit * 1.4;
      c.beginPath();
      c.ellipse(x + dx, y + dy, unit * 0.6, unit * 1.5, 0, 0, 7);
      c.stroke();
    }
  }
  for (let i = 0; i < 38000; i++) {
    const x = rand() * size,
      y = rand() * size;
    c.fillStyle = i % 2 ? "rgba(238,222,167,.13)" : "rgba(33,36,24,.12)";
    c.fillRect(x, y, rand() * 2 + 1, rand() * 2 + 1);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createGroundRenderer(canvas: HTMLCanvasElement, initial: GroundState) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0x242d27);
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x242d27, 190, 320);
  const camera = new T.OrthographicCamera(-70, 70, 70, -70, 0.1, 400);
  scene.add(new T.HemisphereLight(0xe6eddb, 0x61614b, 2.4));
  const sun = new T.DirectionalLight(0xffefd2, 2.5);
  sun.position.set(-45, 85, 35);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 1,
    far: 200,
  });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  const geo = <G extends T.BufferGeometry>(g: G) => {
    geometries.add(g);
    return g;
  };
  const mat = (color: number) => {
    const m = new T.MeshStandardMaterial({ color, roughness: 1 });
    materials.add(m);
    return m;
  };
  const box = geo(new T.BoxGeometry(1, 1, 1)),
    sphere = geo(new T.IcosahedronGeometry(1, 1)),
    cylinder = geo(new T.CylinderGeometry(0.7, 1, 1, 7));
  const mats = {
    wall: mat(COLORS.wall),
    roof: mat(COLORS.roof),
    wood: mat(COLORS.trunk),
    rubble: mat(COLORS.rubble),
    tank: mat(COLORS.tank),
    metal: mat(COLORS.metal),
    leaf: mat(COLORS.leaf),
    light: mat(COLORS.accent),
  };
  function mesh(
    parent: T.Object3D,
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  const terrain = new T.Group();
  scene.add(terrain);
  const tex = groundTexture(initial);
  textures.add(tex);
  const groundMat = new T.MeshStandardMaterial({ map: tex, roughness: 1 });
  materials.add(groundMat);
  mesh(terrain, box, mats.wood, 0, -1, 0, 120, 2, 120);
  const plane = mesh(terrain, geo(new T.PlaneGeometry(120, 120)), groundMat, 0, 0.015, 0, 1, 1, 1);
  plane.rotation.x = -Math.PI / 2;
  plane.castShadow = false;
  const guideGroup = new T.Group();
  scene.add(guideGroup);
  const lineMat = new T.LineDashedMaterial({
    color: 0xe6dab5,
    dashSize: 1,
    gapSize: 1.3,
    transparent: true,
    opacity: 0.7,
  });
  materials.add(lineMat);
  for (const r of initial.layout.routes) {
    const g = geo(
      new T.BufferGeometry().setFromPoints(r.points.map((p) => new T.Vector3(p.x, 0.12, -p.y))),
    );
    const line = new T.Line(g, lineMat);
    line.computeLineDistances();
    guideGroup.add(line);
  }
  function label(text: string, x: number, z: number) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "rgba(27,35,28,.88)";
    ctx.fillRect(0, 0, 512, 96);
    ctx.font = "500 34px monospace";
    ctx.fillStyle = "#e1e4d2";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 61);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    textures.add(t);
    const m = new T.SpriteMaterial({ map: t, depthTest: false, transparent: true });
    materials.add(m);
    const sprite = new T.Sprite(m);
    sprite.position.set(x, 4, z);
    sprite.scale.set(19, 3.56, 1);
    guideGroup.add(sprite);
  }
  label("01 / OPEN FLANK", -36, -41);
  label("02 / VILLAGE", initial.layout.id === "offset" ? 10 : 0, -41);
  label("03 / WOODLAND", 39, -41);
  label("N / OBSERVER", 0, -57);
  const markers = initial.layout.checkpoints.map((p) => {
    const ring = mesh(
      scene,
      geo(new T.RingGeometry(4.1, 4.4, 48)),
      mats.light,
      p.x,
      0.13,
      -p.y,
      1,
      1,
      1,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.castShadow = false;
    return ring;
  });
  const assets = new Map<
    string,
    { group: T.Group; intact?: T.Group; ruin?: T.Group; roof?: T.Group }
  >();
  for (const a of initial.layout.assets.filter((a) => a.kind !== "tree")) {
    const group = new T.Group();
    group.position.set(a.x, 0, -a.y);
    scene.add(group);
    const entry: { group: T.Group; intact?: T.Group; ruin?: T.Group; roof?: T.Group } = { group };
    assets.set(a.id, entry);
    if (a.kind === "building") {
      const intact = new T.Group(),
        roof = new T.Group(),
        ruin = new T.Group();
      group.add(intact, ruin);
      intact.add(roof);
      entry.intact = intact;
      entry.roof = roof;
      entry.ruin = ruin;
      ruin.visible = false;
      const w = a.halfW * 2,
        l = a.halfL * 2,
        h = 3.8 + a.variant * 0.6;
      mesh(intact, box, mats.wall, 0, h / 2, 0, w, h, l);
      for (const side of [-1, 1]) {
        const panel = mesh(
          roof,
          box,
          mats.roof,
          (side * w) / 4,
          h + 0.85,
          0,
          w * 0.57,
          0.28,
          l + 1,
        );
        panel.rotation.z = -side * 0.45;
        for (const z of [-l * 0.26, l * 0.26])
          mesh(intact, box, mats.metal, side * (w / 2 + 0.02), 2, z, 0.05, 0.85, 0.8);
      }
      mesh(intact, box, mats.wood, 0, 1.1, l / 2 + 0.02, 1.3, 2.2, 0.07);
      mesh(roof, box, mats.rubble, w * 0.22, h + 1.2, -l * 0.25, 0.7, 2, 0.7);
      const rand = random(a.id.length + a.x * 701);
      for (let i = 0; i < 12; i++) {
        const r = mesh(
          ruin,
          box,
          i % 3 ? mats.rubble : mats.wood,
          (rand() - 0.5) * w,
          0.25 + rand() * 0.2,
          (rand() - 0.5) * l,
          0.5 + rand() * 1.4,
          0.3 + rand() * 0.5,
          0.5 + rand() * 1.3,
        );
        r.rotation.y = rand() * Math.PI;
      }
    } else if (a.kind === "rock") {
      const r = mesh(group, sphere, mats.rubble, 0, 1, 0, a.halfW, 2.4, a.halfL);
      r.rotation.y = a.variant;
    } else {
      for (const x of [-a.halfW, 0, a.halfW]) mesh(group, box, mats.wood, x, 0.8, 0, 0.2, 1.6, 0.2);
      for (const y of [0.55, 1.2]) mesh(group, box, mats.wood, 0, y, 0, a.halfW * 2, 0.15, 0.2);
    }
  }
  // Repeated vegetation is instanced; a falling tree updates matrices, not draw-call count.
  const trees = initial.layout.assets.filter((a) => a.kind === "tree");
  const trunk = new T.InstancedMesh(cylinder, mats.wood, trees.length),
    crowns = new T.InstancedMesh(sphere, mats.leaf, trees.length * 3);
  trunk.castShadow = crowns.castShadow = true;
  trunk.receiveShadow = crowns.receiveShadow = true;
  scene.add(trunk, crowns);
  trunk.instanceMatrix.setUsage(T.DynamicDrawUsage);
  crowns.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const dummy = new T.Object3D(),
    root = new T.Object3D(),
    local = new T.Matrix4(),
    worldMatrix = new T.Matrix4(),
    axis = new T.Vector3();
  trees.forEach((a, i) => {
    crowns.setColorAt(
      i * 3,
      new T.Color().setHex(0x4e6846).multiplyScalar(0.88 + a.variant * 0.12),
    );
    crowns.setColorAt(i * 3 + 1, new T.Color(0x5e7850));
    crowns.setColorAt(i * 3 + 2, new T.Color(0x77905d));
  });
  function updateTrees(s: GroundState) {
    trees.forEach((a, i) => {
      const angle = (a.fallYaw * Math.PI) / 180,
        t = a.hp <= 0 ? Math.min(1, (s.time - a.fallenAt) / 0.65) : 0;
      axis.set(-Math.cos(angle), 0, Math.sin(angle));
      root.position.set(a.x, 0.05, -a.y);
      root.quaternion.setFromAxisAngle(axis, (1 - Math.cos((t * Math.PI) / 2)) * Math.PI * 0.48);
      root.updateMatrix();
      const instance = (
        target: T.InstancedMesh,
        index: number,
        x: number,
        y: number,
        z: number,
        sx: number,
        sy: number,
        sz: number,
      ) => {
        dummy.position.set(x, y, z);
        dummy.scale.set(sx, sy, sz);
        dummy.rotation.set(0, a.variant * 0.8, 0);
        dummy.updateMatrix();
        local.copy(dummy.matrix);
        worldMatrix.multiplyMatrices(root.matrix, local);
        target.setMatrixAt(index, worldMatrix);
      };
      instance(trunk, i, 0, 2.4, 0, 0.42, 4.8, 0.42);
      for (let j = 0; j < 3; j++)
        instance(
          crowns,
          i * 3 + j,
          Math.sin(j * 2.1) * 0.7,
          4.1 + j * 1.05,
          Math.cos(j * 2.1) * 0.5,
          2.4 - j * 0.55 + a.variant * 0.15,
          1.6,
          2.3 - j * 0.5,
        );
    });
    trunk.instanceMatrix.needsUpdate = crowns.instanceMatrix.needsUpdate = true;
    trunk.computeBoundingSphere();
    crowns.computeBoundingSphere();
  }
  const tank = new T.Group(),
    turret = new T.Group();
  scene.add(tank);
  tank.add(turret);
  mesh(tank, box, mats.tank, 0, 1, 0, 2.6, 1.1, 4.3);
  for (const x of [-1.45, 1.45]) {
    mesh(tank, box, mats.metal, x, 0.65, 0, 0.55, 1.1, 4.6);
    for (let z = -1.65; z < 2; z += 0.8) {
      const wheel = mesh(tank, cylinder, mats.rubble, x, 0.65, z, 0.46, 0.62, 0.46);
      wheel.rotation.z = Math.PI / 2;
    }
  }
  mesh(turret, cylinder, mats.tank, 0, 1.85, 0, 1.2, 0.9, 1.4);
  mesh(turret, box, mats.metal, 0, 1.95, -2.4, 0.2, 0.22, 3.1);
  mesh(turret, cylinder, mats.wood, 0.3, 2.38, 0.2, 0.42, 0.16, 0.42);
  const playerRing = mesh(
    scene,
    geo(new T.RingGeometry(2.7, 2.83, 40)),
    mats.light,
    0,
    0.1,
    0,
    1,
    1,
    1,
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.castShadow = false;
  const shotGeometry = geo(new T.BufferGeometry());
  const shotPositions = new Float32Array(6);
  shotGeometry.setAttribute("position", new T.BufferAttribute(shotPositions, 3));
  const shotMat = new T.LineBasicMaterial({ color: 0xffe8ac });
  materials.add(shotMat);
  const shotLine = new T.Line(shotGeometry, shotMat);
  shotLine.frustumCulled = false;
  scene.add(shotLine);
  const reticle = mesh(
    scene,
    geo(new T.RingGeometry(0.55, 0.65, 24)),
    mats.light,
    0,
    0.15,
    0,
    1,
    1,
    1,
  );
  reticle.rotation.x = -Math.PI / 2;
  reticle.castShadow = false;
  const ray = new T.Raycaster(),
    pointer = new T.Vector2(),
    intersection = new T.Vector3(),
    groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  let width = 0,
    height = 0,
    lastMode = "",
    follow = new T.Vector3(),
    look = new T.Vector3();
  function render(s: GroundState, options: { overview: boolean; guides: boolean }, dt: number) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w !== width || h !== height) {
      width = w;
      height = h;
      renderer.setSize(w, h, false);
    }
    const mode = options.overview ? "overview" : "drive";
    const aspect = w / h,
      span = options.overview ? Math.max(72, 72 / aspect) : Math.max(24, 21 / aspect);
    Object.assign(camera, { left: -span * aspect, right: span * aspect, top: span, bottom: -span });
    camera.updateProjectionMatrix();
    if (options.overview) {
      camera.position.set(0, 125, 64);
      camera.lookAt(0, 0, 0);
    } else {
      const yaw = (s.player.yaw * Math.PI) / 180;
      follow.set(s.player.x + Math.sin(yaw) * 27, 39, -s.player.y + Math.cos(yaw) * 27);
      look.set(s.player.x, 0, -s.player.y);
      if (lastMode !== mode) camera.position.copy(follow);
      else camera.position.lerp(follow, 1 - Math.exp(-dt * 6));
      camera.lookAt(look);
    }
    lastMode = mode;
    guideGroup.visible = options.guides;
    tank.position.set(s.player.x, 0, -s.player.y);
    tank.rotation.y = (s.player.yaw * Math.PI) / 180;
    turret.rotation.y = ((s.player.turret - s.player.yaw) * Math.PI) / 180;
    playerRing.position.set(s.player.x, 0.12, -s.player.y);
    reticle.position.set(s.target.x, 0.16, -s.target.y);
    reticle.visible = !options.overview;
    updateTrees(s);
    for (const a of s.layout.assets) {
      const e = assets.get(a.id);
      if (!e) continue;
      if (e.intact && e.ruin) {
        e.intact.visible = a.hp > 0;
        e.ruin.visible = a.hp <= 0;
        if (e.roof) {
          e.roof.visible = a.hp > a.maxHp / 3;
          e.roof.rotation.z = a.hp < a.maxHp ? 0.08 : 0;
        }
      }
      if (a.kind === "fence") e.group.rotation.x = a.hp <= 0 ? Math.PI / 2 : 0;
    }
    markers.forEach((m, i) => {
      m.visible = !s.visited.includes(s.layout.checkpoints[i].name);
    });
    const shot = s.shots.at(-1);
    shotLine.visible = !!shot;
    if (shot) {
      shotPositions.set([shot.a.x, 1.8, -shot.a.y, shot.b.x, 1.8, -shot.b.y]);
      shotGeometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
    canvas.dataset.ready = "true";
  }
  function aim(clientX: number, clientY: number): Point | undefined {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    ray.setFromCamera(pointer, camera);
    if (!ray.ray.intersectPlane(groundPlane, intersection)) return;
    return { x: intersection.x, y: -intersection.z };
  }
  function dispose() {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    trunk.dispose();
    crowns.dispose();
    renderer.dispose();
  }
  function project(x: number, y: number) {
    const v = new T.Vector3(x, 0, -y).project(camera),
      r = canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) * r.width) / 2, y: r.top + ((1 - v.y) * r.height) / 2 };
  }
  return {
    render,
    aim,
    project,
    dispose,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  };
}

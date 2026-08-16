import * as THREE from 'three';
import { rand } from '../../core/tween.js';
import { NOISE_GLSL, POS2_VERT, makeStaticDust } from '../../core/fx.js';
import { castleWallMaterial, stoneFloorMaterial, woodMaterial, glassMaterial } from './materials.js';
import { createSnitchFlight } from './snitch.js';
import * as props from './props.js';

function archShape(w, h) {
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(-r, h - r);
  s.absarc(0, h - r, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.closePath();
  return s;
}

function glowPanel(w, h) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: POS2_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec2 vP;
      ${NOISE_GLSL}
      void main() {
        vec2 p = vP * 1.4;
        float n = noise(p * 2.0 + vec2(0.0, uTime * 0.1));
        n += 0.6 * noise(p * 4.6 - vec2(uTime * 0.04, 0.0));
        float glow = smoothstep(0.1, 1.3, vP.y) * 0.5 + 0.2;
        vec3 col = mix(vec3(0.03, 0.09, 0.2), vec3(0.5, 0.78, 0.95), n * glow * 0.75);
        gl_FragColor = vec4(col, 0.97);
      }`,
  });
  return new THREE.Mesh(new THREE.ShapeGeometry(archShape(w, h), 24), mat);
}

function nightWindow(w, h, withMoon) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMoon: { value: withMoon ? 1.0 : 0.0 },
      uW: { value: w },
      uH: { value: h },
    },
    vertexShader: POS2_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime, uMoon, uW, uH;
      varying vec2 vP;
      ${NOISE_GLSL}
      void main() {
        vec2 uv = vec2(vP.x / uW + 0.5, vP.y / uH);
        vec3 col = mix(vec3(0.02, 0.04, 0.1), vec3(0.06, 0.12, 0.24), uv.y);
        vec2 g = floor(vP * 14.0);
        if (hash(g) > 0.978) {
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + hash(g + 7.0) * 3.0) + hash(g) * 40.0);
          col += vec3(0.9, 0.95, 1.0) * tw * smoothstep(0.5, 0.0, length(fract(vP * 14.0) - 0.5)) * 0.9;
        }
        col += vec3(0.1, 0.14, 0.22) * noise(vP * 1.2 + vec2(uTime * 0.015, 0.0)) * 0.5;
        if (uMoon > 0.5) {
          vec2 mpos = vec2(uW * 0.16, uH * 0.68);
          float d = length(vP - mpos);
          col += vec3(0.92, 0.95, 1.0) * smoothstep(0.3, 0.27, d);
          col += vec3(0.5, 0.65, 0.9) * smoothstep(0.9, 0.3, d) * 0.35;
          col -= vec3(0.10, 0.08, 0.05) * smoothstep(0.16, 0.05, length(vP - mpos - vec2(0.08, 0.05)));
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.ShapeGeometry(archShape(w, h), 24), mat);
}

function windowLattice(w, h) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, metalness: 0.6, roughness: 0.6 });
  const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.045, h, 0.045), mat);
  vBar.position.y = h / 2;
  g.add(vBar);
  for (const x of [-w / 4, w / 4]) {
    const b = vBar.clone();
    b.position.x = x;
    b.scale.y = 0.92;
    g.add(b);
  }
  for (let i = 1; i <= 3; i++) {
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.045, 0.045), mat);
    hBar.position.y = (h * 0.82 * i) / 3.2;
    g.add(hBar);
  }
  return g;
}

function memoryRack(variant) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x3d2c1e, roughness: 0.9 });
  const W = 1.5, H = 2.2, D = 0.32;
  for (const x of [-W / 2, W / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.07, H, D), wood);
    side.position.set(x, H / 2, 0);
    g.add(side);
  }

  const vialGlass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe8f5, roughness: 0.15, transmission: 0.6, thickness: 0.1,
    emissive: 0x9fd8f0, emissiveIntensity: 0.55,
  });
  const corkMat = new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 0.9 });
  const vials = [];

  const makeVial = () => {
    const h = rand(0.14, 0.22);
    const vial = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(rand(0.028, 0.04), rand(0.032, 0.045), h, 10), vialGlass.clone());
    body.position.y = h / 2;
    vial.add(body);
    const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.035, 8), corkMat);
    cork.position.y = h + 0.015;
    vial.add(cork);
    vials.push(body);
    return vial;
  };
  const vialsGroup = n => {
    const grp = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const v = makeVial();
      v.position.x = (i - (n - 1) / 2) * 0.09 + rand(-0.01, 0.01);
      grp.add(v);
    }
    return grp;
  };

  const layouts = [
    [
      [[() => vialsGroup(4), -0.3], [props.makeSkull, 0.5]],
      [[() => props.makeMiniBooks(5), -0.62], [props.makeRemembrall, 0.45]],
      [[() => vialsGroup(3), -0.35], [props.makeScrolls, 0.42]],
      [[props.makeCauldron, -0.5], [props.makeGoldenEgg, 0.05], [() => vialsGroup(2), 0.5]],
    ],
    [
      [[props.makeCrystalBall, -0.5], [() => vialsGroup(4), 0.25]],
      [[props.makeScrolls, -0.5], [props.makeChessKnight, 0.05], [props.makeLocket, 0.48]],
      [[() => props.makeMiniBooks(4), -0.6], [props.makeQuill, 0.4], [() => vialsGroup(2), 0.05]],
      [[() => vialsGroup(3), -0.35], [() => props.makePotion(0xc23a2a), 0.35], [props.makeDementor, 0.6]],
    ],
  ][variant % 2];

  layouts.forEach((items, s) => {
    const y = 0.28 + s * 0.55;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), wood);
    shelf.position.y = y;
    g.add(shelf);
    for (const [make, x] of items) {
      const item = make();
      item.position.set(x, y + 0.025, rand(-0.03, 0.03));
      item.rotation.y = rand(-0.4, 0.4);
      g.add(item);
    }
  });
  g.userData.vials = vials;
  return g;
}

export function buildRoom() {
  const room = new THREE.Group();
  const panels = [];
  const windows = [];

  room.add(new THREE.AmbientLight(0x2a3550, 0.5));
  const warm = new THREE.PointLight(0xffa85e, 9, 15, 2.0);
  warm.position.set(3.6, 3.2, 2.4);
  room.add(warm);
  const moon = new THREE.SpotLight(0x9fc2ff, 18, 25, 0.5, 0.7, 1.4);
  moon.position.set(-6.8, 5.2, 0.4);
  moon.target.position.set(0, 1.2, 0);
  room.add(moon, moon.target);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), stoneFloorMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const R = 7.3, wallH = 7.4;
  const segW = 2 * R * Math.tan(Math.PI / 8) + 0.25;
  const wallMat = castleWallMaterial();
  const windowAt = { [-90]: true, [-135]: false, [135]: false };
  for (const deg of [-135, -90, 90, 135, 180]) {
    const a = THREE.MathUtils.degToRad(deg);
    const seg = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(segW, wallH, 0.4), wallMat);
    wall.position.y = wallH / 2;
    seg.add(wall);

    if (deg in windowAt) {
      const w = 1.9, h = 4.3;
      const win = nightWindow(w, h, windowAt[deg]);
      win.position.set(0, 1.3, 0.26);
      seg.add(win);
      windows.push(win);
      const lattice = windowLattice(w, h);
      lattice.position.set(0, 1.3, 0.3);
      seg.add(lattice);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.16, 0.55), wallMat);
      sill.position.set(0, 1.22, 0.32);
      seg.add(sill);
    }

    seg.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    seg.rotation.y = a + Math.PI;
    room.add(seg);
  }

  const woodMat = woodMaterial(1.2);
  const panelW = 1.15, panelH = 4.1, gap = 0.16, arc = 0.24;
  for (let i = -2; i <= 2; i++) {
    const slot = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(panelW + gap, panelH + 0.5, 0.18), woodMat);
    frame.position.y = (panelH + 0.5) / 2;
    frame.castShadow = true;
    slot.add(frame);
    const glow = glowPanel(panelW, panelH);
    glow.position.set(0, 0.25, 0.1);
    slot.add(glow);
    panels.push(glow);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, panelH + 0.6, 20), woodMat);
    post.position.set((panelW + gap) / 2, (panelH + 0.6) / 2, 0.12);
    slot.add(post);
    slot.position.set(i * (panelW + gap) * Math.cos(i * arc * 0.4), 0, -2.4 + Math.abs(i) * 0.35);
    slot.rotation.y = -i * arc;
    room.add(slot);
  }
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.35, 0.5), woodMat);
  cornice.position.set(0, panelH + 0.55, -2.3);
  room.add(cornice);

  const rackL = memoryRack(0);
  rackL.position.set(-4.0, 0.15, -1.1);
  rackL.rotation.y = 0.55;
  room.add(rackL);
  const rackR = memoryRack(1);
  rackR.position.set(4.0, 0.15, -1.1);
  rackR.rotation.y = -0.55;
  room.add(rackR);
  const vials = [...rackL.userData.vials, ...rackR.userData.vials];

  const broom = props.makeBroom();
  broom.position.set(4.55, 0, 1.6);
  broom.rotation.set(0.12, 0.6, -0.22);
  room.add(broom);

  const portraitSpots = [
    [45, 3.4, 0], [90, 3.1, 0.1], [90, 4.4, -0.05], [-45, 3.6, 0.05],
  ];
  const portraits = portraitSpots.map(([deg, y, tilt], i) => {
    const a = THREE.MathUtils.degToRad(deg);
    const p = props.makePortrait(i);
    p.position.set(Math.sin(a) * (R - 0.28), y, Math.cos(a) * (R - 0.28));
    p.rotation.y = a + Math.PI;
    p.rotation.z = tilt;
    room.add(p);
    return p;
  });

  const b1 = props.makeBookStack(5);
  b1.position.set(-2.9, 0, 0.7);
  room.add(b1);
  const hat = props.makeSortingHat();
  hat.position.set(-2.9, b1.userData.height - 0.01, 0.7);
  hat.rotation.y = 0.9;
  room.add(hat);
  const b2 = props.makeBookStack(3);
  b2.position.set(3.1, 0, 0.4);
  room.add(b2);
  const b3 = props.makeBookStack(4);
  b3.position.set(4.3, 0, 2.2);
  b3.rotation.y = 0.8;
  room.add(b3);

  const prophecy = props.makeProphecyOrb();
  const shelfSets = [
    [[props.makeHourglass(), -0.55], [props.makePotion(0xd8b435), -0.18],
     [props.makePotion(0x3fae5a), 0.16], [props.makePotion(0x8a3fae), 0.5]],
    [[props.makeOwl(), -0.5], [props.makeWandStand(), 0.05], [prophecy, 0.52]],
  ];
  shelfSets.forEach((items, s) => {
    const shelf = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.5), woodMat);
    shelf.add(board);
    for (const [item, x] of items) {
      item.position.set(x, 0.03, rand(-0.04, 0.04));
      item.rotation.y = rand(-0.5, 0.5);
      shelf.add(item);
    }
    shelf.position.set(-3.7, 1.2 + s * 1.1, 2.1);
    shelf.rotation.y = 0.7;
    room.add(shelf);
  });

  const snitch = props.makeSnitch();
  snitch.position.set(-3.1, 3.05, 2.35);
  room.add(snitch);
  const snitchFlight = createSnitchFlight(snitch);

  const sphere = props.makeArmillarySphere();
  sphere.position.set(-2.9, 3.3, -0.6);
  room.add(sphere);

  const candles = new THREE.Group();
  const candleSpots = [
    [-3.3, 3.6, 1.6], [-2.0, 4.3, 3.0], [2.5, 3.9, 2.4], [3.5, 4.6, 0.6],
    [-2.6, 5.0, -0.9], [1.7, 5.3, -1.3], [0.5, 4.4, 3.6], [-1.2, 3.7, 4.2],
    [3.2, 4.8, 3.4], [-4.1, 4.4, 2.8], [1.4, 3.4, 4.0], [-2.6, 3.2, 4.3],
  ];
  for (const [x, y, z] of candleSpots) {
    const c = props.makeCandle();
    c.position.set(x, y, z);
    c.userData.baseY = y;
    candles.add(c);
  }
  room.add(candles);
  const candleLight = new THREE.PointLight(0xffb060, 30, 16, 2);
  candleLight.position.set(0, 5.2, 1.8);
  room.add(candleLight);

  room.add(makeStaticDust({
    count: 220,
    fill: () => [rand(-5.5, 5.5), rand(0.3, 6), rand(-3, 6)],
    color: 0x8fa8bc, size: 0.015, opacity: 0.4,
  }));

  return {
    group: room,
    update(t, dt, camera) {
      panels.forEach(p => { p.material.uniforms.uTime.value = t; });
      windows.forEach(w => { w.material.uniforms.uTime.value = t; });
      sphere.rotation.y = t * 0.15;
      for (const c of candles.children) {
        const { flame, phase, speed, baseY } = c.userData;
        c.position.y = baseY + Math.sin(t * speed + phase) * 0.18;
        const f = 1 + 0.16 * Math.sin(t * 9 + phase * 3) + 0.07 * Math.sin(t * 23 + phase);
        flame.scale.set(0.16 * f, 0.26 * f, 1);
      }
      candleLight.intensity = 30 + Math.sin(t * 8) * 3;
      for (let i = 0; i < vials.length; i++) {
        vials[i].material.emissiveIntensity = 0.5 + 0.2 * Math.sin(t * 1.4 + i * 1.7);
      }
      snitchFlight.update(t, dt, camera);
      prophecy.userData.mist.material.emissiveIntensity = 0.7 + Math.sin(t * 2.1) * 0.3;
      portraits.forEach(p => p.userData.update(t));
    },
  };
}

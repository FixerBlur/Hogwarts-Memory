import * as THREE from 'three';
import { rand } from '../../core/tween.js';
import { createCanvas, canvasTexture } from '../../core/fx.js';
import { brassMaterial, glassMaterial } from './materials.js';

const BOOK_PALETTE = [0x4a2f22, 0x2e3a2e, 0x3a2a3e, 0x54331f, 0x263043, 0x5a1f1f];

function flameTexture() {
  const { canvas, ctx } = createCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 40, 2, 32, 34, 30);
  g.addColorStop(0, 'rgba(255, 255, 230, 1)');
  g.addColorStop(0.25, 'rgba(255, 214, 120, 0.9)');
  g.addColorStop(0.6, 'rgba(255, 140, 40, 0.35)');
  g.addColorStop(1, 'rgba(255, 90, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTexture(canvas);
}

export const sharedFlameTexture = flameTexture();

export function makeCandle(flameMap = sharedFlameTexture) {
  const g = new THREE.Group();
  const h = rand(0.35, 0.7);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.06, h, 20),
    new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.55 }));
  body.castShadow = true;
  g.add(body);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameMap, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe6b0,
  }));
  flame.scale.set(0.16, 0.26, 1);
  flame.position.y = h / 2 + 0.1;
  g.add(flame);
  g.userData = { flame, phase: rand(0, Math.PI * 2), speed: rand(0.6, 1.2) };
  return g;
}

export function makeArmillarySphere() {
  const g = new THREE.Group();
  const brass = brassMaterial();
  [0.55, 0.45, 0.34].forEach((r, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.024, 16, 96), brass);
    ring.rotation.set(rand(0, Math.PI), rand(0, Math.PI), i * 0.9);
    g.add(ring);
  });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.35, 12), brass);
  axis.rotation.z = 0.5;
  g.add(axis);
  return g;
}

const PORTRAIT_CHARACTERS = [
  {
    bg: ['#2a2244', '#171030'], robe: '#3a2a52', skin: '#d8b896',
    hair: '#e6e2d8', longHair: true, longBeard: true, glasses: 'half',
  },
  {
    bg: ['#1c3226', '#0e1f16'], robe: '#1f3a2a', skin: '#d8b49a',
    hair: '#4a4440', hat: '#16281c', tightHair: true,
  },
  {
    bg: ['#1d1d24', '#0d0d12'], robe: '#141418', skin: '#cfae90',
    hair: '#17151a', curtains: true,
  },
  {
    bg: ['#2e2620', '#161210'], robe: '#2a2a30', skin: '#d8b09a',
    hair: '#1c1a18', messy: true, glasses: 'round', scar: true,
  },
];

function drawPortrait(ctx, c, t, phase) {
  const grd = ctx.createLinearGradient(0, 0, 0, 160);
  grd.addColorStop(0, c.bg[0]);
  grd.addColorStop(1, c.bg[1]);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 128, 160);

  ctx.fillStyle = c.robe;
  ctx.beginPath();
  ctx.ellipse(64, 152, 42, 48, 0, Math.PI, 0);
  ctx.fill();

  const sway = Math.sin(t * 0.4 + phase) * 2.5;
  const nod = Math.sin(t * 0.27 + phase * 2) * 0.05;
  const blink = ((t + phase * 3) % 4.2) < 0.14;

  ctx.save();
  ctx.translate(64 + sway, 66);
  ctx.rotate(nod);

  if (c.longHair) {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(0, 14, 30, 44, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 19, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  if (c.tightHair) {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(0, -14, 20, 12, 0, Math.PI, 0);
    ctx.fill();
  }
  if (c.curtains) {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(0, -16, 21, 10, 0, Math.PI, 0);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 16, 4, 6, 26, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (c.messy) {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.ellipse(0, -17, 20, 10, 0, Math.PI, 0);
    ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 8, -22, 5, 7, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (c.longBeard) {
    ctx.fillStyle = c.hair;
    ctx.beginPath();
    ctx.moveTo(-15, 8);
    ctx.quadraticCurveTo(-14, 66, 0, 74);
    ctx.quadraticCurveTo(14, 66, 15, 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 12, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (c.hat) {
    ctx.fillStyle = c.hat;
    ctx.beginPath();
    ctx.ellipse(0, -20, 27, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, -21);
    ctx.quadraticCurveTo(2, -34, 10, -58);
    ctx.quadraticCurveTo(14, -36, 16, -21);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#1c1410';
  if (blink) {
    ctx.fillRect(-11, -5, 7, 1.6);
    ctx.fillRect(4, -5, 7, 1.6);
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 7.5, -4, 2.2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (c.glasses) {
    ctx.strokeStyle = 'rgba(30, 24, 18, 0.9)';
    ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (c.glasses === 'round') ctx.arc(s * 7.5, -4, 5.5, 0, Math.PI * 2);
      else ctx.arc(s * 7.5, -5.5, 5.5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-2, -5);
    ctx.lineTo(2, -5);
    ctx.stroke();
  }
  if (c.scar) {
    ctx.strokeStyle = 'rgba(120, 50, 40, 0.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-7, -19);
    ctx.lineTo(-4, -15);
    ctx.lineTo(-8, -12);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(90, 55, 40, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, 12);
  ctx.quadraticCurveTo(0, 13.5, 4, 12);
  ctx.stroke();
  ctx.restore();

  const v = ctx.createRadialGradient(64, 80, 30, 64, 80, 110);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 160);
}

export function makePortrait(characterIndex) {
  const character = PORTRAIT_CHARACTERS[characterIndex % PORTRAIT_CHARACTERS.length];
  const { canvas, ctx } = createCanvas(128, 160);
  const phase = characterIndex * 1.7;
  drawPortrait(ctx, character, 0, phase);
  const tex = canvasTexture(canvas);

  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.06, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x8a6b2a, metalness: 0.85, roughness: 0.45, envMapIntensity: 0.5 }));
  g.add(frame);
  const canvasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.92),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  canvasMesh.position.z = 0.035;
  g.add(canvasMesh);

  let lastDraw = 0;
  g.userData.update = t => {
    if (t - lastDraw < 0.09) return;
    lastDraw = t;
    drawPortrait(ctx, character, t, phase);
    tex.needsUpdate = true;
  };
  return g;
}

export function makeBookStack(count) {
  const g = new THREE.Group();
  let y = 0;
  for (let i = 0; i < count; i++) {
    const h = rand(0.05, 0.09);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(rand(0.34, 0.46), h, rand(0.26, 0.34)),
      new THREE.MeshStandardMaterial({ color: BOOK_PALETTE[i % BOOK_PALETTE.length], roughness: 0.92 }));
    book.position.set(rand(-0.03, 0.03), y + h / 2, rand(-0.03, 0.03));
    book.rotation.y = rand(-0.25, 0.25);
    book.castShadow = true;
    g.add(book);
    y += h;
  }
  g.userData.height = y;
  return g;
}

export function makeMiniBooks(n) {
  const g = new THREE.Group();
  let x = 0;
  for (let i = 0; i < n; i++) {
    const h = rand(0.16, 0.22), w = rand(0.03, 0.05);
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.13),
      new THREE.MeshStandardMaterial({ color: BOOK_PALETTE[i % BOOK_PALETTE.length], roughness: 0.92 }));
    const lean = i === n - 1 ? -0.35 : rand(-0.06, 0.06);
    book.rotation.z = lean;
    book.position.set(x, h / 2 + Math.abs(lean) * 0.02, 0);
    g.add(book);
    x += w + 0.008;
  }
  return g;
}

export function makeScrolls() {
  const g = new THREE.Group();
  const parchment = new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.9 });
  for (const [x, y] of [[-0.03, 0.028], [0.05, 0.028], [0.01, 0.082]]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.22, 10), parchment);
    s.rotation.z = Math.PI / 2;
    s.rotation.y = rand(-0.3, 0.3);
    s.position.set(x, y, 0);
    g.add(s);
  }
  return g;
}

export function makeCauldron() {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.7, roughness: 0.55 });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), iron);
  pot.scale.y = 0.85;
  pot.position.y = 0.085;
  g.add(pot);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 20), iron);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.152;
  g.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.05, 6), iron);
    leg.position.set(Math.cos(a) * 0.05, 0.02, Math.sin(a) * 0.05);
    g.add(leg);
  }
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16),
    new THREE.MeshStandardMaterial({ color: 0x3fae5a, emissive: 0x1f7a35, emissiveIntensity: 0.6 }));
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = 0.145;
  g.add(brew);
  return g;
}

export function makeSkull() {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xd8d0bc, roughness: 0.8 });
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), bone);
  cranium.scale.set(0.9, 1, 1.05);
  cranium.position.y = 0.075;
  g.add(cranium);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.05), bone);
  jaw.position.set(0, 0.025, 0.02);
  g.add(jaw);
  for (const s of [-1, 1]) {
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    socket.position.set(s * 0.02, 0.075, 0.047);
    g.add(socket);
  }
  return g;
}

export function makeCrystalBall() {
  const g = new THREE.Group();
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.8 }));
  foot.position.y = 0.02;
  g.add(foot);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.065, 24, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfe8f0, roughness: 0.03, transmission: 0.95, thickness: 0.06, ior: 1.5,
    }));
  ball.position.y = 0.1;
  g.add(ball);
  return g;
}

export function makeRemembrall() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 18, 14),
    new THREE.MeshPhysicalMaterial({
      color: 0xe8e0d0, roughness: 0.05, transmission: 0.85, thickness: 0.02, metalness: 0.2,
    }));
  shell.position.y = 0.05;
  g.add(shell);
  const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xc23a2a, emissive: 0x8a1f14, emissiveIntensity: 0.8,
      transparent: true, opacity: 0.75, roughness: 1,
    }));
  smoke.position.y = 0.05;
  g.add(smoke);
  return g;
}

export function makeGoldenEgg() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd8ae4a, metalness: 1.0, roughness: 0.3, envMapIntensity: 0.8,
  });
  const egg = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), gold);
  egg.scale.y = 1.3;
  egg.position.y = 0.095;
  g.add(egg);
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.006, 6, 24), gold);
  seam.rotation.x = Math.PI / 2;
  seam.position.y = 0.095;
  g.add(seam);
  return g;
}

export function makeLocket() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xb8942e, metalness: 1.0, roughness: 0.35, envMapIntensity: 0.7,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), gold);
  body.scale.set(1, 1.15, 0.4);
  body.position.y = 0.05;
  g.add(body);
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0x1f7a35, emissive: 0x0f4a1e, emissiveIntensity: 0.9, roughness: 0.2,
    }));
  gem.position.set(0, 0.05, 0.02);
  g.add(gem);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), gold);
  loop.position.y = 0.105;
  g.add(loop);
  return g;
}

export function makeChessKnight() {
  const g = new THREE.Group();
  const marble = new THREE.MeshStandardMaterial({ color: 0xcfc8ba, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.03, 14), marble);
  base.position.y = 0.015;
  g.add(base);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 0.09, 12), marble);
  body.position.y = 0.075;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.07), marble);
  head.position.set(0, 0.14, 0.012);
  head.rotation.x = -0.35;
  g.add(head);
  const ears = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 6), marble);
  ears.position.set(0, 0.17, -0.01);
  g.add(ears);
  return g;
}

export function makeQuill() {
  const g = new THREE.Group();
  const ink = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.06, 10),
    new THREE.MeshPhysicalMaterial({ color: 0x1a2030, roughness: 0.2, metalness: 0.1 }));
  ink.position.y = 0.03;
  g.add(ink);
  const featherGeo = new THREE.PlaneGeometry(0.03, 0.22, 1, 8);
  const pos = featherGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setX(i, pos.getX(i) * (1 - Math.abs(y) * 2.2));
    pos.setZ(i, Math.pow(y + 0.11, 2) * 1.4);
  }
  featherGeo.computeVertexNormals();
  const feather = new THREE.Mesh(featherGeo,
    new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7, side: THREE.DoubleSide }));
  feather.position.set(0, 0.15, -0.01);
  feather.rotation.x = 0.3;
  g.add(feather);
  return g;
}

export function makeBroom() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 1.5, 10),
    new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.7 }));
  stick.position.y = 0.95;
  g.add(stick);
  const bristles = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 12),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1.0 }));
  bristles.rotation.x = Math.PI;
  bristles.position.y = 0.22;
  g.add(bristles);
  const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 10),
    new THREE.MeshStandardMaterial({ color: 0x9a7c3f, metalness: 0.8, roughness: 0.4 }));
  binding.position.y = 0.42;
  g.add(binding);
  return g;
}

export function makePotion(liquidColor) {
  const g = new THREE.Group();
  const glass = glassMaterial();
  const h = rand(0.14, 0.2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, h, 12), glass);
  body.position.y = h / 2;
  g.add(body);
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.046, h * 0.55, 12),
    new THREE.MeshStandardMaterial({
      color: liquidColor, emissive: liquidColor, emissiveIntensity: 0.7, roughness: 0.3,
    }));
  liquid.position.y = h * 0.3;
  g.add(liquid);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.05, 10), glass);
  neck.position.y = h + 0.022;
  g.add(neck);
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.017, 0.03, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: 0.9 }));
  cork.position.y = h + 0.06;
  g.add(cork);
  return g;
}

export function makeHourglass() {
  const g = new THREE.Group();
  const brass = brassMaterial();
  for (const y of [0.012, 0.29]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.024, 20), brass);
    disc.position.y = y;
    g.add(disc);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), brass);
    post.position.set(Math.cos(a) * 0.075, 0.15, Math.sin(a) * 0.075);
    g.add(post);
  }
  const glass = glassMaterial();
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 14), glass);
  top.position.y = 0.21;
  g.add(top);
  const bottom = top.clone();
  bottom.rotation.x = Math.PI;
  bottom.position.y = 0.09;
  g.add(bottom);
  const sand = new THREE.Mesh(
    new THREE.ConeGeometry(0.04, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8b45a, emissive: 0x8a6a20, emissiveIntensity: 0.4 }));
  sand.rotation.x = Math.PI;
  sand.position.y = 0.06;
  g.add(sand);
  return g;
}

export function makeOwl() {
  const g = new THREE.Group();
  const feather = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.85 });
  const speckle = new THREE.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), feather);
  body.scale.set(0.85, 1.25, 0.8);
  body.position.y = 0.1;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), feather);
  head.position.y = 0.21;
  g.add(head);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xf2b53a, emissive: 0x7a5210, emissiveIntensity: 0.5 }));
    eye.position.set(s * 0.02, 0.22, 0.042);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    pupil.position.set(s * 0.02, 0.22, 0.053);
    g.add(pupil);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), speckle);
    wing.scale.set(0.35, 1.1, 0.7);
    wing.position.set(s * 0.062, 0.1, -0.01);
    wing.rotation.z = -s * 0.15;
    g.add(wing);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 0.6 }));
  beak.rotation.x = Math.PI / 2.4;
  beak.position.set(0, 0.2, 0.05);
  g.add(beak);
  return g;
}

export function makeWandStand() {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.85 }));
  stand.position.y = 0.02;
  g.add(stand);
  const woods = [0x5a3a22, 0x3a2a1c, 0x6b4a2e];
  for (let i = 0; i < 3; i++) {
    const wand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.009, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: woods[i], roughness: 0.7 }));
    wand.position.set(-0.08 + i * 0.08, 0.16, 0);
    wand.rotation.z = rand(-0.12, 0.12);
    wand.rotation.x = rand(-0.05, 0.05);
    g.add(wand);
  }
  return g;
}

export function makeProphecyOrb() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 24, 18),
    new THREE.MeshPhysicalMaterial({
      color: 0xcfe0ec, roughness: 0.05, transmission: 0.9, thickness: 0.03, ior: 1.5,
    }));
  shell.position.y = 0.1;
  g.add(shell);
  const mist = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xbfd8ff, emissive: 0x88aaff, emissiveIntensity: 0.9,
      transparent: true, opacity: 0.6, roughness: 1,
    }));
  mist.position.y = 0.1;
  g.add(mist);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.035, 12),
    new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.8 }));
  foot.position.y = 0.017;
  g.add(foot);
  g.userData.mist = mist;
  return g;
}

export function makeSortingHat() {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.95 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.02, 20), leather);
  brim.position.y = 0.01;
  g.add(brim);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.16, 16), leather);
  lower.position.y = 0.09;
  g.add(lower);
  const mid = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.13, 14), leather);
  mid.position.set(0.012, 0.19, 0);
  mid.rotation.z = -0.25;
  g.add(mid);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 10), leather);
  tip.position.set(0.05, 0.26, 0);
  tip.rotation.z = -0.75;
  g.add(tip);
  const fold = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 14, Math.PI), leather);
  fold.position.set(0, 0.105, 0.062);
  fold.rotation.set(0.35, 0, Math.PI);
  g.add(fold);
  return g;
}

export function makeDementor() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 1.0 });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.3, 12), cloth);
  cloak.position.y = 0.15;
  g.add(cloak);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), cloth);
  hood.scale.set(1, 1.15, 1.05);
  hood.position.set(0, 0.3, 0.008);
  g.add(hood);
  const dark = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  dark.position.set(0, 0.29, 0.028);
  g.add(dark);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.16, 8), cloth);
    arm.position.set(s * 0.065, 0.18, 0.02);
    arm.rotation.z = s * 0.55;
    g.add(arm);
  }
  return g;
}

export function makeSnitch() {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 20, 16),
    new THREE.MeshStandardMaterial({
      color: 0xd8ae4a, metalness: 1.0, roughness: 0.25,
      emissive: 0x6a4a10, emissiveIntensity: 0.35, envMapIntensity: 0.8,
    }));
  g.add(ball);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0xdfe8f0, transparent: true, opacity: 0.75,
    side: THREE.DoubleSide, roughness: 0.4,
  });
  const wings = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.028, 6, 1), wingMat);
    const pos = wing.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      pos.setY(i, pos.getY(i) + Math.abs(x) * 0.25);
    }
    wing.geometry.computeVertexNormals();
    wing.position.set(s * 0.085, 0.012, 0);
    wing.rotation.z = s * 0.35;
    wings.push(wing);
    g.add(wing);
  }
  g.userData.wings = wings;
  return g;
}

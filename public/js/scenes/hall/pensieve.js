import * as THREE from 'three';
import { rand } from '../../core/tween.js';
import { createCanvas, canvasTexture, makeParticles, makeBeam } from '../../core/fx.js';
import { carvedStoneMaterial } from './materials.js';

const texLoader = new THREE.TextureLoader();

function runeTexture() {
  const size = 1024;
  const { canvas, ctx } = createCanvas(size, size);
  ctx.translate(size / 2, size / 2);
  ctx.lineCap = 'round';
  const R = size * 0.465;
  for (let i = 0; i < 32; i++) {
    ctx.save();
    ctx.rotate((i / 32) * Math.PI * 2);
    ctx.translate(0, -R);
    const strokes = 3 + Math.floor(Math.random() * 3);
    ctx.strokeStyle = 'rgba(30, 26, 20, 0.9)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(rand(-12, 12), rand(-16, 16));
    for (let s = 0; s < strokes; s++) ctx.lineTo(rand(-14, 14), rand(-18, 18));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140, 200, 235, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }
  return canvasTexture(canvas);
}

function makeWater(radius) {
  const n1 = texLoader.load('assets/textures/waternormals.jpg');
  const n2 = texLoader.load('assets/textures/waternormals.jpg');
  for (const t of [n1, n2]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  n1.repeat.set(2.2, 2.2);
  n2.repeat.set(3.6, 3.6);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x6fa8c8, metalness: 0.35, roughness: 0.08,
    normalMap: n1, normalScale: new THREE.Vector2(0.6, 0.6),
    clearcoat: 0.8, clearcoatRoughness: 0.15, clearcoatNormalMap: n2,
    emissive: 0x2a5e88, emissiveIntensity: 0.22, envMapIntensity: 0.7,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, n1, n2 };
}

function makeGlowSprite() {
  const { canvas, ctx } = createCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, 'rgba(230, 250, 255, 0.9)');
  g.addColorStop(0.4, 'rgba(150, 215, 245, 0.35)');
  g.addColorStop(1, 'rgba(90, 160, 210, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(canvas), blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sprite.scale.set(1.5, 0.7, 1);
  return sprite;
}

function makeLightBeam(height, radius, intensity) {
  const mesh = makeBeam({
    radiusTop: radius * 1.7, radiusBottom: radius, height, segments: 32, intensity,
    fade: 'pow(1.0 - vUv.y, 2.0)',
    flicker: '0.9 + 0.1 * sin(uTime * 1.6 + vUv.y * 5.0)',
    color: 'mix(vec3(0.6, 0.85, 1.0), vec3(0.95, 1.0, 1.0), fade)',
  });
  mesh.position.y = height / 2;
  return mesh;
}

function makeMotes(count, radius) {
  return makeParticles({
    count,
    fill: () => {
      const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * radius;
      return [Math.cos(a) * r, rand(0, 3.5), Math.sin(a) * r];
    },
    motion: /* glsl */`
      float life = fract(aSeed + uTime * (0.03 + aSeed * 0.04));
      p.y = life * 3.5;
      p.x += sin(uTime * 0.7 + aSeed * 40.0) * 0.1;
      p.z += cos(uTime * 0.6 + aSeed * 30.0) * 0.1;
      vA = smoothstep(0.0, 0.15, life) * smoothstep(1.0, 0.55, life);`,
    size: '1.5 + aSeed * 3.0',
    color: 'vec3(0.75, 0.92, 1.0)',
    alpha: '0.8',
  });
}

export function buildPensieve() {
  const group = new THREE.Group();
  const animated = [];
  const stone = carvedStoneMaterial();

  const profile = [
    [0.12, 0.72], [0.5, 0.74], [0.95, 0.82], [1.25, 0.96],
    [1.45, 1.14], [1.53, 1.26], [1.56, 1.33],
    [1.5, 1.36], [1.42, 1.33], [1.3, 1.24],
    [1.1, 1.16], [0.5, 1.1], [0.01, 1.08],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), stone);
  bowl.castShadow = true;
  group.add(bowl);

  const runes = new THREE.Mesh(
    new THREE.RingGeometry(1.28, 1.56, 64),
    new THREE.MeshStandardMaterial({
      map: runeTexture(), transparent: true,
      emissive: 0x86c8e8, emissiveIntensity: 0.32, roughness: 0.8,
    }));
  runes.rotation.x = -Math.PI / 2;
  runes.position.y = 1.345;
  group.add(runes);

  const band = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.025, 12, 96),
    new THREE.MeshStandardMaterial({ color: 0x7c7264, roughness: 0.9 }));
  band.rotation.x = Math.PI / 2;
  band.position.y = 1.05;
  group.add(band);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.75, 8), stone);
  pedestal.position.y = 0.38;
  pedestal.castShadow = true;
  group.add(pedestal);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.12, 8), stone);
  cap.position.y = 0.72;
  group.add(cap);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 0.18, 8), stone);
  base.position.y = 0.09;
  base.castShadow = true;
  group.add(base);

  const { mesh: water, n1, n2 } = makeWater(1.38);
  water.position.y = 1.27;
  group.add(water);

  const glowSprite = makeGlowSprite();
  glowSprite.position.y = 1.42;
  group.add(glowSprite);

  const beams = new THREE.Group();
  [[0, 0, 0.32, 5.2, 0.22], [-0.4, 0.18, 0.15, 4.4, 0.15], [0.4, -0.14, 0.18, 4.7, 0.18]]
    .forEach(([x, z, r, h, k]) => {
      const b = makeLightBeam(h, r, k);
      b.position.x = x;
      b.position.z = z;
      beams.add(b);
      animated.push(b.material);
    });
  beams.position.y = 1.27;
  group.add(beams);

  const motes = makeMotes(70, 1.1);
  motes.position.y = 1.3;
  group.add(motes);
  animated.push(motes.material);

  const glow = new THREE.PointLight(0x8fd4ff, 22, 18, 1.9);
  glow.position.set(0, 2.5, 0);
  glow.castShadow = true;
  glow.shadow.mapSize.set(1024, 1024);
  glow.shadow.bias = -0.002;
  group.add(glow);
  const glowLow = new THREE.PointLight(0x3f8fc9, 10, 8, 2);
  glowLow.position.set(0, 1.4, 1.2);
  group.add(glowLow);
  const warmFill = new THREE.PointLight(0xffc27a, 4, 5, 2);
  warmFill.position.set(0, 0.5, 2.0);
  group.add(warmFill);

  let stir = 0;
  return {
    group,
    splash() { stir = 1; },
    update(t, dt) {
      stir = Math.max(0, stir - dt * 0.35);
      n1.offset.set(t * 0.018, t * 0.012);
      n2.offset.set(-t * 0.011, t * 0.016);
      water.rotation.z = t * 0.05;
      water.material.emissiveIntensity = 0.22 + stir * 0.7 + Math.sin(t * 1.3) * 0.04;
      glowSprite.material.opacity = 0.28 + Math.sin(t * 1.7) * 0.06 + stir * 0.35;
      runes.material.emissiveIntensity = 0.32 + Math.sin(t * 1.1) * 0.08 + stir * 0.4;
      glow.intensity = 22 + Math.sin(t * 1.7) * 3 + stir * 30;
      for (const m of animated) m.uniforms.uTime.value = t;
    },
  };
}

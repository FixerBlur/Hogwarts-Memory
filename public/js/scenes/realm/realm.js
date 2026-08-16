import * as THREE from 'three';
import { rand, tween, easeInOut, easeOut } from '../../core/tween.js';
import { NOISE_GLSL, makeParticles, makeStaticDust, makeBeam } from '../../core/fx.js';
import { letterTexture, photoTexture, previewTexture, cardGeometry } from './cards.js';

function makeDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      void main() {
        float a = atan(vDir.z, vDir.x);
        float h = vDir.y;
        vec2 p = vec2(a * 2.5 - uTime * 0.06, h * 3.0);
        float n = noise(p * 1.6) + 0.5 * noise(p * 3.7 + vec2(uTime * 0.03, 0.0));
        float top = smoothstep(-0.4, 0.9, h);
        vec3 col = mix(vec3(0.035, 0.09, 0.17), vec3(0.38, 0.55, 0.72), n * 0.35 + top * 0.3);
        float swirl = sin(a * 3.0 + uTime * 0.15 + h * 4.0) * 0.5 + 0.5;
        col += vec3(0.25, 0.35, 0.45) * swirl * smoothstep(0.55, 1.0, h) * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(14, 48, 32), mat);
}

function makeDownRay(x, z, radius, intensity) {
  const mesh = makeBeam({
    radiusTop: radius, radiusBottom: radius * 1.9, height: 14, intensity,
    fade: 'pow(vUv.y, 1.8)',
    flicker: '0.85 + 0.15 * sin(uTime * 1.3 + vUv.x * 12.0)',
    color: 'vec3(0.7, 0.85, 1.0)',
  });
  mesh.position.set(x, 4, z);
  return mesh;
}

function makeWisps(count) {
  return makeParticles({
    count,
    fill: () => {
      const a = rand(0, Math.PI * 2), r = rand(2.5, 9);
      return [Math.cos(a) * r, rand(-4, 4), Math.sin(a) * r];
    },
    motion: /* glsl */`
      p.y += sin(uTime * 0.4 + aSeed * 30.0) * 0.6;
      p.x += cos(uTime * 0.3 + aSeed * 20.0) * 0.4;
      vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed) + aSeed * 40.0));`,
    size: '3.0 + aSeed * 6.0',
    color: 'vec3(0.75, 0.9, 1.0)',
    alpha: '0.7',
  });
}

function makeDust(count) {
  return makeStaticDust({
    count,
    fill: () => [rand(-9, 9), rand(-6, 6), rand(-9, 9)],
    color: 0xaadfff, size: 0.03, opacity: 0.5,
  });
}

function makeThreads(count) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const pts = [];
    const base = new THREE.Vector3(rand(-6, 6), rand(-4, 4), rand(-6, 6));
    let dir = new THREE.Vector3(rand(-1, 1), rand(-0.5, 0.5), rand(-1, 1)).normalize();
    for (let s = 0; s < 8; s++) {
      pts.push(base.clone());
      dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rand(-0.9, 0.9));
      dir.y += rand(-0.4, 0.4);
      base.addScaledVector(dir.normalize(), rand(0.3, 0.6));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 6, false),
      new THREE.MeshBasicMaterial({
        color: 0xbfe4ff, transparent: true, opacity: rand(0.25, 0.5),
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    tube.userData.spin = rand(-0.06, 0.06);
    g.add(tube);
  }
  return g;
}

export function buildRealm() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081a30);
  scene.fog = new THREE.FogExp2(0x081a30, 0.055);

  scene.add(new THREE.AmbientLight(0x88aadd, 2.3));
  const heaven = new THREE.DirectionalLight(0xcfeaff, 4.2);
  heaven.position.set(0, 8, 2);
  scene.add(heaven);

  const dome = makeDome();
  scene.add(dome);
  const rays = [makeDownRay(0, -3, 1.6, 0.16), makeDownRay(-4, 1, 1.1, 0.12), makeDownRay(3.5, 2.5, 1.3, 0.13)];
  rays.forEach(r => scene.add(r));
  const wisps = makeWisps(46);
  scene.add(wisps);
  scene.add(makeDust(320));
  const threads = makeThreads(9);
  scene.add(threads);

  const cards = [];
  const cardsGroup = new THREE.Group();
  const letterTexes = [letterTexture(), letterTexture(), letterTexture()];
  const photoTexes = [photoTexture(), photoTexture()];
  for (let i = 0; i < 26; i++) {
    const isPhoto = i % 3 === 2;
    const tex = isPhoto
      ? photoTexes[i % photoTexes.length]
      : letterTexes[i % letterTexes.length];
    const card = new THREE.Mesh(
      isPhoto ? cardGeometry(0.52, 0.61) : cardGeometry(0.55, 0.73),
      new THREE.MeshStandardMaterial({
        map: tex, side: THREE.DoubleSide,
        emissive: 0x2e4a6e, emissiveIntensity: 0.4, roughness: 0.85,
      }));
    const a = rand(0, Math.PI * 2);
    const r = rand(2.2, 6.5);
    card.position.set(Math.cos(a) * r, rand(-2.5, 2.5), Math.sin(a) * r);
    card.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
    card.userData = {
      home: card.position.clone(),
      spin: new THREE.Vector3(rand(-0.35, 0.35), rand(-0.45, 0.45), rand(-0.25, 0.25)),
      bobPhase: rand(0, Math.PI * 2),
      bobAmp: rand(0.15, 0.4),
    };
    cards.push(card);
    cardsGroup.add(card);
  }
  scene.add(cardsGroup);

  let chosen = null;
  const returning = new Set(); // cards still tweening back home — not eligible for summon

  return {
    scene,

    summonCard(camera, memory) {
      return new Promise(resolve => {
        const candidates = cards.filter(c => !returning.has(c));
        chosen = candidates[Math.floor(Math.random() * candidates.length)];
        scene.attach(chosen);
        if (memory) {
          chosen.userData.baseMap = chosen.material.map;
          chosen.material.map = previewTexture(memory.title, memory.author);
        }
        const from = chosen.position.clone();
        const fromQ = chosen.quaternion.clone();
        const target = new THREE.Vector3(0, 0, -1.1)
          .applyQuaternion(camera.quaternion).add(camera.position);
        const lookQ = new THREE.Quaternion();
        tween({
          duration: 1.6,
          ease: easeInOut,
          onUpdate: k => {
            chosen.position.lerpVectors(from, target, k);
            const m = new THREE.Matrix4().lookAt(camera.position, chosen.position, camera.up);
            lookQ.setFromRotationMatrix(m);
            chosen.quaternion.slerpQuaternions(fromQ, lookQ, k);
            chosen.material.emissiveIntensity = 0.4 + k * 1.0;
          },
          onDone: resolve,
        });
      });
    },

    releaseCard() {
      if (!chosen) return;
      const card = chosen;
      chosen = null;
      cardsGroup.attach(card);
      if (card.userData.baseMap) {
        card.material.map.dispose();
        card.material.map = card.userData.baseMap;
        delete card.userData.baseMap;
      }
      const from = card.position.clone();
      returning.add(card);
      tween({
        duration: 1.2,
        ease: easeOut,
        onUpdate: k => {
          card.position.lerpVectors(from, card.userData.home, k);
          card.material.emissiveIntensity = 1.4 - k * 1.0;
        },
        onDone: () => returning.delete(card),
      });
    },

    update(t, dt) {
      dome.material.uniforms.uTime.value = t;
      wisps.material.uniforms.uTime.value = t;
      for (const r of rays) r.material.uniforms.uTime.value = t;
      cardsGroup.rotation.y = t * 0.05;
      threads.rotation.y = -t * 0.03;
      for (const th of threads.children) th.rotation.y += th.userData.spin * dt;
      for (const c of cards) {
        if (c === chosen) continue;
        c.rotation.x += c.userData.spin.x * dt;
        c.rotation.y += c.userData.spin.y * dt;
        c.rotation.z += c.userData.spin.z * dt;
        if (returning.has(c)) continue; // let the release tween own the position
        c.position.y = c.userData.home.y + Math.sin(t * 0.8 + c.userData.bobPhase) * c.userData.bobAmp;
      }
    },
  };
}

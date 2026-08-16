import * as THREE from 'three';
import { rand } from '../../core/tween.js';
import { NOISE_GLSL, UV_VERT, createCanvas, canvasTexture, makeParticles } from '../../core/fx.js';

function flashTexture(variant) {
  const { canvas, ctx } = createCanvas(160, 120);
  const palettes = [
    ['rgba(255, 214, 140, 0.85)', 'rgba(180, 110, 40, 0.3)'],
    ['rgba(170, 215, 255, 0.85)', 'rgba(70, 110, 170, 0.3)'],
    ['rgba(200, 255, 200, 0.75)', 'rgba(70, 140, 90, 0.28)'],
  ];
  const [core, halo] = palettes[variant % palettes.length];
  const g = ctx.createRadialGradient(80, 60, 6, 80, 60, 80);
  g.addColorStop(0, core);
  g.addColorStop(0.5, halo);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 120);
  for (let i = 0; i < 3; i++) {
    const b = ctx.createRadialGradient(
      rand(35, 125), rand(30, 90), 2, rand(35, 125), rand(30, 90), rand(14, 30));
    b.addColorStop(0, 'rgba(30, 30, 45, 0.5)');
    b.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, 160, 120);
  }
  return canvasTexture(canvas);
}

export function buildVortex() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030a14);
  scene.fog = new THREE.FogExp2(0x030a14, 0.028);

  const camera = new THREE.PerspectiveCamera(
    68, window.innerWidth / window.innerHeight, 0.1, 120);

  const tunnelMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDir: { value: 1 } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uDir;
      varying vec2 vUv;
      ${NOISE_GLSL}
      void main() {
        float a = vUv.x * 6.28318;
        float len = vUv.y * 60.0;
        float s1 = sin(a * 5.0 + len - uTime * 18.0 * uDir);
        float s2 = sin(-a * 3.0 + len * 0.7 - uTime * 13.0 * uDir);
        float streak1 = pow(max(s1, 0.0), 6.0);
        float streak2 = pow(max(s2, 0.0), 8.0);
        float mist = noise(vec2(a * 2.0, len * 0.15 - uTime * 2.2 * uDir)) * 0.4;
        vec3 silver = vec3(0.55, 0.72, 0.88);
        vec3 deep = vec3(0.07, 0.16, 0.3);
        vec3 col = deep * (mist + 0.15) + silver * (streak1 * 0.22 + streak2 * 0.12);
        float alpha = clamp(streak1 * 0.35 + streak2 * 0.2 + mist * 0.45, 0.0, 0.8);
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const tunnels = [];
  for (const [rTop, rBottom] of [[3.4, 2.2], [5.2, 3.6]]) {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, 90, 48, 1, true);
    geo.rotateX(Math.PI / 2);
    const mat = tunnelMat.clone();
    mat.uniforms.uTime = { value: 0 };
    mat.uniforms.uDir = { value: 1 };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -35;
    tunnels.push(mesh);
    scene.add(mesh);
  }

  const particles = makeParticles({
    count: 420,
    fill: () => {
      const a = rand(0, Math.PI * 2), r = rand(0.5, 2.6);
      return [Math.cos(a) * r, Math.sin(a) * r, 0];
    },
    motion: /* glsl */`
      float life = fract(aSeed + uTime * (0.5 + aSeed * 0.4));
      p.z = mix(-75.0, 4.0, life);
      vA = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.85, life);`,
    size: '2.0 + aSeed * 5.0',
    sizeScale: 40,
    color: 'vec3(0.7, 0.85, 0.95)',
    alpha: '0.55',
  });
  scene.add(particles);

  const endGlow = new THREE.PointLight(0xbfe4ff, 22, 90, 1.6);
  endGlow.position.set(0, 0, -55);
  scene.add(endGlow);

  const flashTexes = [flashTexture(0), flashTexture(1), flashTexture(2)];
  const flashes = [];
  for (let i = 0; i < 9; i++) {
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.8),
      new THREE.MeshBasicMaterial({
        map: flashTexes[i % flashTexes.length], transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
    const a = rand(0, Math.PI * 2);
    const r = rand(0.9, 2.3);
    flash.userData = {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      seed: i / 9 + rand(0, 0.06),
      speed: rand(0.09, 0.14),
      roll: rand(-0.4, 0.4),
    };
    flashes.push(flash);
    scene.add(flash);
  }

  let elapsed = 0;
  let dir = 1;

  return {
    scene,
    camera,
    start(direction = 1) {
      dir = direction;
      elapsed = 0;
      for (const tn of tunnels) tn.material.uniforms.uDir.value = direction;
      camera.rotation.set(0, 0, 0);
      camera.fov = 62;
      camera.updateProjectionMatrix();
    },
    update(t, dt) {
      elapsed += dt;
      for (const [i, tn] of tunnels.entries()) {
        tn.material.uniforms.uTime.value = t * (i ? 0.6 : 1);
        tn.rotation.z += dt * dir * (i ? -0.35 : 0.6);
      }
      particles.material.uniforms.uTime.value = t;
      for (const flash of flashes) {
        const { x, y, seed, speed, roll } = flash.userData;
        const life = (t * speed + seed) % 1;
        flash.position.set(x, y, -70 + life * 74);
        flash.rotation.z = roll + t * 0.15 * dir;
        flash.material.opacity =
          Math.min(1, life * 5) * Math.min(1, (1 - life) * 3) * 0.5;
        const s = 0.7 + life * 1.1;
        flash.scale.set(s, s, 1);
      }
      const ramp = Math.min(elapsed * 1.4, 1);
      camera.fov = 62 + ramp * 26;
      camera.rotation.z += dt * dir * (0.5 + ramp * 1.1);
      camera.rotation.x = Math.sin(elapsed * 2.3) * 0.04 * ramp;
      camera.position.x = Math.sin(elapsed * 1.7) * 0.12 * ramp;
      camera.position.y = Math.cos(elapsed * 2.1) * 0.1 * ramp;
      camera.updateProjectionMatrix();
    },
  };
}

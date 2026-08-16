// Shared visual-effect helpers: GLSL snippets, particle clouds, light beams,
// canvas-texture plumbing. Used by all three scenes.
import * as THREE from 'three';

export const NOISE_GLSL = /* glsl */`
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }`;

export const UV_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Vertex shader that forwards local XY position instead of UVs — for
// ShapeGeometry surfaces whose UVs are not normalized.
export const POS2_VERT = /* glsl */`
  varying vec2 vP;
  void main() {
    vP = vec2(position.x, position.y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

export function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

export function canvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function positionBuffer(count, fill) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = fill(i);
    pos[i * 3] = x;
    pos[i * 3 + 1] = y;
    pos[i * 3 + 2] = z;
  }
  return new THREE.BufferAttribute(pos, 3);
}

// Animated additive point cloud. `motion` is a GLSL block that may read
// aSeed/uTime, move `vec3 p` and must set the alpha varying `vA`.
// `size` is a GLSL expression (may use aSeed); `color`/`alpha` are literals
// spliced into the fragment shader.
export function makeParticles({ count, fill, motion, size, sizeScale = 30, color, alpha }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', positionBuffer(count, fill));
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) seed[i] = Math.random();
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      varying float vA;
      void main() {
        vec3 p = position;
        ${motion}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (${size}) * (${sizeScale.toFixed(1)} / max(-mv.z, 0.5));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(${color}, smoothstep(0.5, 0.0, d) * vA * ${alpha});
      }`,
  });
  return new THREE.Points(geo, mat);
}

// Motionless additive dust cloud on a plain PointsMaterial.
export function makeStaticDust({ count, fill, color, size, opacity }) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', positionBuffer(count, fill));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}

// Open-ended cylinder rendered as a volumetric light shaft. `fade`, `flicker`
// and `color` are GLSL expressions (color may reference `fade`).
export function makeBeam({ radiusTop, radiusBottom, height, segments = 24, intensity, fade, flicker, color }) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uIntensity: { value: intensity } },
    vertexShader: UV_VERT,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uIntensity;
      varying vec2 vUv;
      void main() {
        float fade = ${fade};
        float flicker = ${flicker};
        float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
        gl_FragColor = vec4(${color}, fade * flicker * edge * uIntensity);
      }`,
  });
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, true), mat);
}

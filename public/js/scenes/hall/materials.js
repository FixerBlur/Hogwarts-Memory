import * as THREE from 'three';

const loader = new THREE.TextureLoader();

export function loadTexture(url, { srgb = false, repeat = 1, repeatY = null } = {}) {
  const tex = loader.load(url);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeatY ?? repeat);
  return tex;
}

function texturedMaterial(prefix, { repeat, repeatY = null, ao = false, ...extra }) {
  const tex = suffix => loadTexture(
    `assets/textures/${prefix}_${suffix}.jpg`, { srgb: suffix === 'diff', repeat, repeatY });
  return new THREE.MeshStandardMaterial({
    map: tex('diff'),
    normalMap: tex('nor'),
    roughnessMap: tex('rough'),
    ...(ao && { aoMap: tex('ao') }),
    roughness: 1.0,
    ...extra,
  });
}

export function woodMaterial(repeat = 1.5) {
  return texturedMaterial('wood', { repeat, color: 0x7a6350 });
}

export function castleWallMaterial(repeat = 2.6, repeatY = 3.2) {
  return texturedMaterial('wall', { repeat, repeatY, ao: true, color: 0x8d8478 });
}

export function stoneFloorMaterial(repeat = 5) {
  return texturedMaterial('floor', { repeat, ao: true });
}

export function carvedStoneMaterial(repeat = 2.5) {
  const normalMap = loadTexture('assets/textures/wall_nor.jpg', { repeat });
  const roughnessMap = loadTexture('assets/textures/wall_rough.jpg', { repeat });
  return new THREE.MeshStandardMaterial({
    color: 0x7b7264, roughness: 0.82,
    normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap, envMapIntensity: 0.25,
  });
}

export function brassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9a7c3f, metalness: 1.0, roughness: 0.32, envMapIntensity: 0.6,
  });
}

export function glassMaterial(color = 0xd8e8f0) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.08, transmission: 0.85, thickness: 0.05, ior: 1.5,
  });
}

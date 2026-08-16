import * as THREE from 'three';
import { RGBELoader } from '../../../vendor/RGBELoader.js';
import { buildRoom } from './room.js';
import { buildPensieve } from './pensieve.js';

function loadEnvironment(renderer, scene) {
  return new Promise(resolve => {
    new RGBELoader().load('assets/hdri/fireplace_1k.hdr', hdr => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      pmrem.dispose();
      resolve();
    }, undefined, () => resolve());
  });
}

export async function buildHall(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b15);
  scene.fog = new THREE.FogExp2(0x070b15, 0.045);

  await loadEnvironment(renderer, scene);

  const room = buildRoom();
  scene.add(room.group);
  const pensieve = buildPensieve();
  scene.add(pensieve.group);

  return {
    scene,
    pensieve,
    update(t, dt, camera) {
      room.update(t, dt, camera);
      pensieve.update(t, dt);
    },
  };
}

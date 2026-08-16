import * as THREE from 'three';
import { EffectComposer } from '../../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../../vendor/postprocessing/OutputPass.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.4, 0.9));
  composer.addPass(new OutputPass());

  return {
    composer,
    setView(scene, camera) {
      renderPass.scene = scene;
      renderPass.camera = camera;
    },
    resize(width, height) {
      composer.setSize(width, height);
    },
  };
}

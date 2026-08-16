import * as THREE from 'three';
import { rand } from '../../core/tween.js';

/* Wandering flight for the golden snitch: darts between random points around
   the hall and, every now and then, comes to hover right in front of the
   camera before shooting away. */

const ROAM_RADIUS = 5.6;   // keep clear of the walls (room radius 7.3)
const MIN_Y = 0.8;
const MAX_Y = 5.2;
const CAMERA_GAP = 0.85;   // how close it hovers in front of the lens

const desired = new THREE.Vector3();
const camDir = new THREE.Vector3();

export function createSnitchFlight(snitch) {
  const velocity = new THREE.Vector3();
  const target = new THREE.Vector3();
  let mode = 'roam';             // roam | approach | hover
  let hoverUntil = 0;
  let nextVisit = rand(6, 12);   // when to next fly up to the camera
  let heading = 0;

  function pickRoamTarget() {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * ROAM_RADIUS;
    target.set(Math.cos(a) * r, rand(MIN_Y, MAX_Y), Math.sin(a) * r);
    mode = 'roam';
  }
  pickRoamTarget();

  return {
    update(t, dt, camera) {
      if (mode === 'roam' && camera && t > nextVisit) mode = 'approach';
      if (mode !== 'roam' && camera) {
        // chase a point just in front of the lens; follows the camera sway
        camera.getWorldDirection(camDir);
        target.copy(camera.position).addScaledVector(camDir, CAMERA_GAP);
        target.y -= 0.12;
      }

      const dist = snitch.position.distanceTo(target);
      if (mode === 'roam' && dist < 0.3) pickRoamTarget();
      else if (mode === 'approach' && dist < 0.3) {
        mode = 'hover';
        hoverUntil = t + rand(1.4, 2.4);
      } else if (mode === 'hover' && t > hoverUntil) {
        nextVisit = t + rand(16, 30);
        pickRoamTarget();
      }

      const maxSpeed = mode === 'roam' ? 1.9 : mode === 'approach' ? 2.8 : 0.6;
      desired.subVectors(target, snitch.position).normalize().multiplyScalar(maxSpeed);
      // erratic snitch-like jitter on top of the steering
      desired.x += Math.sin(t * 7.3) * 0.35;
      desired.y += Math.sin(t * 9.1 + 2) * 0.3;
      desired.z += Math.cos(t * 8.2 + 1) * 0.35;
      velocity.lerp(desired, Math.min(dt * 2.5, 1));
      snitch.position.addScaledVector(velocity, dt);

      snitch.position.y = THREE.MathUtils.clamp(snitch.position.y, MIN_Y, MAX_Y + 0.3);
      if (mode === 'roam') {
        // glide back inside the hall — never snap, or the snitch visibly
        // teleports right after a camera visit (the camera sits near a wall)
        const horiz = Math.hypot(snitch.position.x, snitch.position.z);
        if (horiz > ROAM_RADIUS + 0.8) {
          const pull = Math.min(horiz - (ROAM_RADIUS + 0.8), 2.5 * dt);
          const k = (horiz - pull) / horiz;
          snitch.position.x *= k;
          snitch.position.z *= k;
        }
      }

      // face the direction of travel
      if (velocity.lengthSq() > 0.01) {
        const want = Math.atan2(velocity.x, velocity.z);
        const turn = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
        heading += turn * Math.min(dt * 6, 1);
        snitch.rotation.y = heading;
      }

      // wings flutter harder the faster it flies
      const flutter = 0.35 + Math.sin(t * 26) * (0.22 + velocity.length() * 0.1);
      for (const [i, wing] of snitch.userData.wings.entries()) {
        wing.rotation.z = (i ? 1 : -1) * flutter;
      }
    },
  };
}

import * as THREE from 'three';
import { tween, easeIn, easeOut, easeInOut } from '../../core/tween.js';
import { createCanvas, canvasTexture } from '../../core/fx.js';

/* Film-style memory deposit: a wand slides into frame beside the camera,
   reaches out until its tip hovers over the basin, a silvery drop of memory
   forms at the tip and falls straight down into the water, then the arm
   pulls back. While held, the wand is re-anchored to the camera every frame
   so it sways with the viewer's "hand". */

const SILVER = 0xdfeeff;
const WAND_LENGTH = 0.4;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const run = opts => new Promise(resolve => tween({ ...opts, onDone: resolve }));

function glowTexture() {
  const { canvas, ctx } = createCanvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(240, 250, 255, 1)');
  g.addColorStop(0.35, 'rgba(190, 225, 250, 0.55)');
  g.addColorStop(1, 'rgba(120, 180, 230, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTexture(canvas);
}

function makeWand() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.012, WAND_LENGTH, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a2617, roughness: 0.6 }));
  shaft.position.y = WAND_LENGTH / 2;
  g.add(shaft);
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.015, 0.11, 12),
    new THREE.MeshStandardMaterial({ color: 0x241207, roughness: 0.8 }));
  grip.position.y = 0.055;
  g.add(grip);
  return g;
}

export function playWandDeposit({ scene, camera, target, onSplash }) {
  return new Promise(async resolve => {
    const group = new THREE.Group();
    scene.add(group);

    const wand = makeWand();
    group.add(wand);

    const glowMap = glowTexture();
    const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    tipGlow.scale.setScalar(0.14);
    group.add(tipGlow);

    const drop = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
    }));
    drop.scale.setScalar(0.0001);
    group.add(drop);

    const light = new THREE.PointLight(0xa8e4ff, 0, 5, 2);
    group.add(light);

    // short silvery tail streaming above the falling drop
    const tail = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: SILVER, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    tail.visible = false;
    group.add(tail);

    // per-frame scratch
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const hold = new THREE.Vector3();
    const hand = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const tip = new THREE.Vector3();
    const aimCur = new THREE.Vector3();

    // held pose aims loosely above the basin; the reach pose hovers the tip
    // right over the water so the drop lands inside the bowl
    const aimHold = target.clone().add(new THREE.Vector3(0, 0.4, 0));
    const handEnd = target.clone().add(new THREE.Vector3(0.12, 0.72, 0.75));
    const aimEnd = target.clone().add(new THREE.Vector3(0, 0.28, 0));

    /* enterK: 0 = off-frame at the lower right, 1 = held beside the camera.
       reachK: 0 = held, 1 = arm extended, tip hovering over the basin. */
    function placeWand(enterK, reachK) {
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      up.setFromMatrixColumn(camera.matrixWorld, 1);
      fwd.setFromMatrixColumn(camera.matrixWorld, 2).negate();
      hold.copy(camera.position)
        .addScaledVector(fwd, 0.5)
        .addScaledVector(right, 0.26 + (1 - enterK) * 0.4)
        .addScaledVector(up, -0.16 - (1 - enterK) * 0.35);
      hand.lerpVectors(hold, handEnd, reachK);
      aimCur.lerpVectors(aimHold, aimEnd, reachK);
      dir.subVectors(aimCur, hand).normalize();
      wand.position.copy(hand);
      wand.quaternion.setFromUnitVectors(Y_AXIS, dir);
      tip.copy(hand).addScaledVector(dir, WAND_LENGTH);
      tipGlow.position.copy(tip);
      light.position.copy(tip);
    }

    function rebuildTail(top, bottom) {
      tail.geometry.dispose();
      tail.geometry = new THREE.TubeGeometry(
        new THREE.LineCurve3(top.clone(), bottom.clone()), 1, 0.005, 6, false);
    }

    // 1. the wand slides into frame, its tip lighting up
    await run({
      duration: 0.7, ease: easeOut,
      onUpdate: k => {
        placeWand(k, 0);
        tipGlow.material.opacity = k * 0.9;
        light.intensity = k * 3;
      },
    });

    // 2. the arm reaches out until the tip hovers over the water
    await run({
      duration: 0.8, ease: easeInOut,
      onUpdate: k => {
        placeWand(1, k);
        light.intensity = 3 + k * 3;
      },
    });

    // 3. a drop of memory swells at the tip
    await run({
      duration: 0.5, ease: easeInOut,
      onUpdate: k => {
        placeWand(1, 1);
        drop.position.copy(tip);
        drop.scale.setScalar(0.05 + k * 0.17);
        drop.material.opacity = k;
        light.intensity = 6 + k * 3;
      },
    });

    // 4. it falls straight down into the basin
    const fallFrom = tip.clone();
    const fallTo = new THREE.Vector3(fallFrom.x, target.y, fallFrom.z);
    tail.visible = true;
    await run({
      duration: 0.5, ease: easeIn,
      onUpdate: k => {
        placeWand(1, 1);
        drop.position.lerpVectors(fallFrom, fallTo, k);
        const tailTop = Math.min(0.14, fallFrom.y - drop.position.y) * (1 - k * 0.6);
        rebuildTail(drop.position.clone().add(new THREE.Vector3(0, tailTop, 0)), drop.position);
        drop.material.opacity = k > 0.85 ? (1 - k) / 0.15 : 1;
        light.position.copy(drop.position);
      },
    });
    tail.visible = false;
    onSplash?.();

    // 5. the arm pulls back, then the wand slips out of frame
    await run({
      duration: 0.5, ease: easeInOut,
      onUpdate: k => {
        placeWand(1, 1 - k);
        light.position.copy(tip);
        light.intensity = 6 * (1 - k) + 2;
      },
    });
    await run({
      duration: 0.5, ease: easeIn,
      onUpdate: k => {
        placeWand(1 - k, 0);
        tipGlow.material.opacity = 0.9 * (1 - k);
        light.intensity = 2 * (1 - k);
      },
    });

    scene.remove(group);
    tail.geometry.dispose();
    tail.material.dispose();
    tipGlow.material.dispose();
    drop.material.dispose();
    glowMap.dispose();
    for (const part of wand.children) {
      part.geometry.dispose();
      part.material.dispose();
    }
    resolve();
  });
}

import * as THREE from 'three';
import { createComposer } from './core/postprocessing.js';
import { tween, updateTweens, easeIn, easeOut, easeInOut } from './core/tween.js';
import { buildHall } from './scenes/hall/hall.js';
import { playWandDeposit } from './scenes/hall/deposit.js';
import { buildRealm } from './scenes/realm/realm.js';
import { buildVortex } from './scenes/vortex/vortex.js';
import * as audio from './core/audio.js';
import * as api from './api.js';
import * as ui from './ui.js';
import * as i18n from './i18n.js';

i18n.init();

THREE.Cache.enabled = true;

let hideLoaderTimer = null;
THREE.DefaultLoadingManager.onStart = () => clearTimeout(hideLoaderTimer);
THREE.DefaultLoadingManager.onProgress = (url, loaded, total) => {
  ui.setLoadProgress(loaded / total);
};
THREE.DefaultLoadingManager.onLoad = () => {
  hideLoaderTimer = setTimeout(() => {
    ui.setLoadProgress(1);
    ui.hideLoader();
  }, 350);
};
setTimeout(() => ui.hideLoader(true), 15000);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Phones get a lower pixel-ratio cap: bloom + soft shadows at retina x3 is a slideshow.
const isTouch = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 60);
const realmCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 40);
realmCamera.position.set(0, 0, 0.001);

const hall = await buildHall(renderer);
const realm = buildRealm();
const vortex = buildVortex();
const view = createComposer(renderer, hall.scene, camera);

const VIEWS = {
  intro:  { pos: new THREE.Vector3(0, 2.7, 7.6), look: new THREE.Vector3(0, 1.9, -0.5) },
  basin:  { pos: new THREE.Vector3(0, 2.35, 3.3), look: new THREE.Vector3(0, 1.35, 0) },
  dive:   { pos: new THREE.Vector3(0, 1.62, 0.14), look: new THREE.Vector3(0, 1.26, 0) },
  plunge: { pos: new THREE.Vector3(0, 1.31, 0.03), look: new THREE.Vector3(0, 1.1, -0.05) },
};
const camPos = VIEWS.intro.pos.clone();
const camLook = VIEWS.intro.look.clone();
let swayAmount = 1;

function flyTo(target, duration, ease = easeInOut) {
  return new Promise(resolve => {
    const p0 = camPos.clone(), l0 = camLook.clone();
    tween({
      duration, ease,
      onUpdate: k => {
        camPos.lerpVectors(p0, target.pos, k);
        camLook.lerpVectors(l0, target.look, k);
      },
      onDone: resolve,
    });
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Flash into the vortex, ride it for `rideMs`, flash out into `dest`.
// Leaves the screen flashed white — the caller reveals the new world.
async function rideVortex({ dir, entryMs, rideMs, whooshLen, dest }) {
  ui.flash(true);
  await sleep(entryMs);
  vortex.start(dir);
  activeWorld = 'vortex';
  audio.setScene('vortex');
  audio.whoosh(whooshLen);
  ui.flash(false);
  await sleep(rideMs);
  ui.flash(true);
  await sleep(300);
  activeWorld = dest;
  audio.setScene(dest);
}

let state = 'intro';       // intro | basin | write | diving | realm | reading
let activeWorld = 'hall';  // hall | vortex | realm
let currentMemoryId = null;
let lastWrittenId = null;
let busy = false;

async function approach() {
  if (busy) return;
  busy = true;
  ui.showOverlay(null);
  await flyTo(VIEWS.basin, 2.2);
  state = 'basin';
  ui.showOverlay('choice');
  busy = false;
}

async function retreat() {
  if (busy) return;
  busy = true;
  ui.showOverlay(null);
  await flyTo(VIEWS.intro, 1.8);
  state = 'intro';
  ui.showOverlay('intro');
  busy = false;
}

async function submitMemory(fields) {
  if (busy) return;
  busy = true;
  let id;
  try {
    ({ id } = await api.addMemory(fields));
  } catch (err) {
    busy = false;
    throw err; // ui.js shows the message next to the form
  }
  lastWrittenId = id;
  ui.showOverlay(null);
  audio.chime();
  await playWandDeposit({
    scene: hall.scene,
    camera,
    target: new THREE.Vector3(0, 1.32, 0),
    onSplash: () => {
      hall.pensieve.splash();
      audio.splash(0.7);
    },
  });
  ui.toast(i18n.t('toast.deposited'));
  state = 'basin';
  ui.showOverlay('choice');
  busy = false;
}

async function dive() {
  if (busy) return;
  busy = true;

  let memory;
  try {
    memory = await api.randomMemory(lastWrittenId);
  } catch (err) {
    ui.toast(err.message);
    busy = false;
    return;
  }

  state = 'diving';
  // audio leads the picture: the dive theme starts on the click itself,
  // while the camera is still approaching the basin
  audio.setScene('vortex');
  ui.showOverlay(null);
  swayAmount = 0;
  await flyTo(VIEWS.dive, 1.0);
  hall.pensieve.splash();
  await flyTo(VIEWS.plunge, 0.55, easeIn);
  audio.splash();
  await rideVortex({ dir: 1, entryMs: 240, rideMs: 2700, whooshLen: 2.8, dest: 'realm' });
  ui.flash(false);
  state = 'realm';

  await sleep(700);
  await realm.summonCard(realmCamera, memory);
  await sleep(1100);
  currentMemoryId = memory.id;
  ui.showMemory(memory);
  state = 'reading';
  busy = false;
}

async function anotherMemory() {
  if (busy) return;
  busy = true;
  let memory;
  try {
    memory = await api.randomMemory(currentMemoryId);
  } catch (err) {
    ui.toast(err.message);
    busy = false;
    return;
  }
  ui.showOverlay(null);
  realm.releaseCard();
  await sleep(500);
  await realm.summonCard(realmCamera, memory);
  await sleep(1100);
  currentMemoryId = memory.id;
  ui.showMemory(memory);
  busy = false;
}

async function surface() {
  if (busy) return;
  busy = true;
  ui.showOverlay(null);
  realm.releaseCard();
  await sleep(400);
  await rideVortex({ dir: -1, entryMs: 260, rideMs: 1400, whooshLen: 1.8, dest: 'hall' });
  audio.splash(0.6);
  camPos.copy(VIEWS.plunge.pos);
  camLook.copy(VIEWS.plunge.look);
  ui.flash(false);
  await flyTo(VIEWS.basin, 1.5, easeOut);
  swayAmount = 1;
  state = 'basin';
  ui.showOverlay('choice');
  busy = false;
}

ui.bindUI({
  onApproach: approach,
  onRetreat: retreat,
  onOpenWrite: () => { state = 'write'; ui.showOverlay('write-modal'); },
  onCancelWrite: () => { state = 'basin'; ui.showOverlay('choice'); },
  onDive: dive,
  onSubmitMemory: submitMemory,
  onAnotherMemory: anotherMemory,
  onSurface: surface,
});

const muteBtn = document.getElementById('mute-btn');
const syncMuteIcon = () => { muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊'; };
syncMuteIcon();
muteBtn.onclick = () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  syncMuteIcon();
};

const volumeSlider = document.getElementById('volume-slider');
volumeSlider.value = Math.round(audio.getVolume() * 100);
volumeSlider.oninput = () => {
  audio.unlock();
  audio.setVolume(volumeSlider.value / 100);
  if (audio.isMuted() && volumeSlider.value > 0) {
    audio.setMuted(false);
    syncMuteIcon();
  }
};
document.getElementById('lang-btn').onclick = () => i18n.toggle();
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
// not a real gesture, but where the autoplay policy allows it the theme
// starts from the very first mouse move
window.addEventListener('pointermove', () => audio.tryAutostart(), { once: true });

const pointer = new THREE.Vector2();
const parallax = new THREE.Vector2();
window.addEventListener('pointermove', e => {
  pointer.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    (e.clientY / window.innerHeight) * 2 - 1);
});

const raycaster = new THREE.Raycaster();
canvas.addEventListener('click', e => {
  if (state !== 'intro') return;
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.intersectObject(hall.pensieve.group, true).length) approach();
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  view.resize(window.innerWidth, window.innerHeight);
  for (const cam of [camera, realmCamera, vortex.camera]) {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  }
});

const clock = new THREE.Clock();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  updateTweens(dt);
  hall.update(t, dt, camera);
  realm.update(t, dt);

  if (activeWorld === 'hall') {
    parallax.lerp(pointer, Math.min(dt * 4, 1));
    camera.position.set(
      camPos.x + Math.sin(t * 0.5) * 0.05 * swayAmount + parallax.x * 0.3 * swayAmount,
      camPos.y + Math.sin(t * 0.8) * 0.03 * swayAmount - parallax.y * 0.15 * swayAmount,
      camPos.z);
    camera.lookAt(
      camLook.x + parallax.x * 0.12 * swayAmount,
      camLook.y - parallax.y * 0.07 * swayAmount,
      camLook.z);
    view.setView(hall.scene, camera);
  } else if (activeWorld === 'vortex') {
    vortex.update(t, dt);
    view.setView(vortex.scene, vortex.camera);
  } else {
    realmCamera.rotation.z = Math.sin(t * 0.3) * 0.02;
    view.setView(realm.scene, realmCamera);
  }
  view.composer.render();
}
loop();

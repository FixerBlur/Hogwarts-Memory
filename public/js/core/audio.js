let ctx = null;
let master = null;
let reverb = null;
let noiseBuffer = null;
let muted = localStorage.getItem('pensieveMuted') === '1';
const storedVolume = parseFloat(localStorage.getItem('pensieveVolume'));
let volume = Number.isFinite(storedVolume) ? Math.min(Math.max(storedVolume, 0), 1) : 1;
let scene = 'hall';
let ambient = null;
let bellTimer = null;

/* Scene soundtracks. Streamed via <audio> elements (decoded multi-minute
   buffers would eat tens of MB of RAM) and routed through the master bus,
   so the mute button and scene crossfades apply to them too. Elements are
   created at module load so the downloads start right away: by the user's
   first click a track is ready, and play() can run inside that same
   gesture — which autoplay policies always allow. */
const TRACKS = {
  hall: {
    url: 'assets/audio/Harry-Potter-Theme-Music-_-Copyright-Free-_Hedwig_s-Theme_.mp3',
    level: 0.15,
  },
  vortex: {
    url: "assets/audio/Lily_s-Theme-But-It_s-Even-Darker-_Slowed-Down-To-Perfection-Reverb_-Alexandre-Desplat.mp3",
    level: 0.15,
  },
};
TRACKS.realm = TRACKS.vortex; // one track carries the whole dive, no restart

for (const track of new Set(Object.values(TRACKS))) {
  track.el = new Audio(track.url);
  track.el.loop = true;
  track.el.preload = 'auto';
  track.node = null;
  track.ready = false;
  track.el.addEventListener('canplay', () => {
    track.ready = true;
    engageMusic();
  }, { once: true });
}

const SCALES = {
  hall:  [329.6, 392.0, 440.0, 493.9, 587.3, 659.3],
  realm: [440.0, 523.3, 587.3, 659.3, 784.0, 880.0],
};

function makeReverbImpulse(seconds = 3.2) {
  const rate = ctx.sampleRate;
  const length = rate * seconds;
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.8);
    }
  }
  return impulse;
}

function makeNoiseBuffer() {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = makeReverbImpulse();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.45;
    reverb.connect(reverbGain).connect(master);
    noiseBuffer = makeNoiseBuffer();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseSource(loop = false) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = loop;
  return src;
}

function osc(type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function gainNode(value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function biquad(type, freq) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  return f;
}

// Attack/decay gain envelope starting at `start`.
function envelope(start, peak, attack, duration) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(peak, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  return env;
}

// Route a node to the master bus, optionally with the shared reverb send.
function output(node, withReverb = true) {
  node.connect(master);
  if (withReverb) node.connect(reverb);
}

function bell(freq, duration = 2.6, volume = 0.05) {
  const t = ctx.currentTime;
  const carrier = osc('sine', freq);
  const mod = osc('sine', freq * 3.98);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 1.6, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + duration);
  mod.connect(modGain).connect(carrier.frequency);
  const pan = ctx.createStereoPanner();
  pan.pan.value = Math.random() * 1.4 - 0.7;
  carrier.connect(envelope(t, volume, 0.008, duration)).connect(pan);
  output(pan);
  carrier.start(t);
  mod.start(t);
  carrier.stop(t + duration + 0.1);
  mod.stop(t + duration + 0.1);
}

/* Autoplay policies reject play() outside a user-gesture handler, so every
   playback attempt that fails re-arms itself for the next gesture. */
function onNextGesture(fn) {
  window.addEventListener('pointerdown', fn, { once: true });
  window.addEventListener('keydown', fn, { once: true });
}

function playTrack(track) {
  track.el.play().catch(() => {
    onNextGesture(() => {
      if (ambient?.track === track && track.el.paused) playTrack(track);
    });
  });
}

/* Crossfade the current synth ambient to the scene's track — but only once
   the browser has actually let playback start, so a rejected play() never
   leaves the scene silent. */
function engageMusic() {
  const track = TRACKS[scene];
  if (!track?.ready || !ambient || ambient.track === track) return;
  track.el.play().then(() => {
    if (TRACKS[scene] === track && ambient && ambient.track !== track) switchAmbient();
    else if (ambient?.track !== track) track.el.pause(); // scene changed while we were asking
  }).catch(() => {
    onNextGesture(engageMusic);
  });
}

/* Best-effort start without a real gesture (e.g. on the first mouse move).
   Browsers only promise audible playback after a click/tap/key, so this
   succeeds just where the autoplay policy is lenient; a rejection is silent
   and the regular gesture chain picks the track up later. Plays the raw
   element — the WebAudio graph may not exist yet — so the element's own
   volume stands in for the mix level until the graph takes over. */
export function tryAutostart() {
  const track = TRACKS[scene];
  if (muted || !track || track.node || !track.el.paused) return;
  track.el.volume = track.level * volume;
  track.el.play().catch(() => {});
}

function buildTrackAmbient(track) {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);
  if (!track.node) track.node = ctx.createMediaElementSource(track.el);
  track.el.volume = 1; // the graph's gain node owns the level from here on
  track.node.disconnect();
  track.node.connect(gainNode(track.level)).connect(out);
  playTrack(track);
  return {
    out,
    // the same element may carry the next scene too (vortex -> realm), so
    // only pause it if the current ambient is no longer playing it
    stops: [() => { if (ambient?.track !== track) track.el.pause(); }],
    isMusic: true,
    track,
  };
}

function scheduleBells() {
  clearTimeout(bellTimer);
  const notes = SCALES[scene];
  if (!notes || muted || ambient?.isMusic) return;
  const delay = 3500 + Math.random() * 5500;
  bellTimer = setTimeout(() => {
    if (ctx && SCALES[scene]) {
      bell(notes[Math.floor(Math.random() * notes.length)]);
      if (Math.random() < 0.35) {
        setTimeout(() => bell(notes[Math.floor(Math.random() * notes.length)], 2.2, 0.035), 420);
      }
    }
    scheduleBells();
  }, delay);
}

function buildAmbient(kind) {
  const track = TRACKS[kind];
  if (track?.ready) return buildTrackAmbient(track);
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(master);
  const stops = [];

  const pad = (freq, type, gainValue) => {
    const o = osc(type, freq);
    o.detune.value = Math.random() * 10 - 5;
    const g = gainNode(gainValue);
    o.connect(g).connect(out);
    o.start();
    stops.push(() => o.stop());
    return g;
  };

  const wind = (filterFreq, gainValue, lfoFreq) => {
    const src = noiseSource(true);
    const g = gainNode(gainValue);
    const lfo = osc('sine', lfoFreq);
    lfo.connect(gainNode(gainValue * 0.5)).connect(g.gain);
    src.connect(biquad('lowpass', filterFreq)).connect(g).connect(out);
    src.start();
    lfo.start();
    stops.push(() => { src.stop(); lfo.stop(); });
  };

  if (kind === 'hall') {
    pad(82.4, 'triangle', 0.03);
    pad(123.5, 'sine', 0.025);
    pad(164.8, 'sine', 0.014);
    wind(320, 0.02, 0.07);
  } else if (kind === 'realm') {
    pad(220, 'sine', 0.02);
    pad(330, 'sine', 0.012);
    pad(440.5, 'sine', 0.007);
    wind(900, 0.022, 0.05);
  } else if (kind === 'vortex') {
    pad(55, 'sawtooth', 0.02);
    const src = noiseSource(true);
    const filter = biquad('bandpass', 500);
    filter.Q.value = 0.8;
    const lfo = osc('sine', 0.4);
    lfo.connect(gainNode(380)).connect(filter.frequency);
    src.connect(filter).connect(gainNode(0.11)).connect(out);
    src.start();
    lfo.start();
    stops.push(() => { src.stop(); lfo.stop(); });
  }
  return { out, stops };
}

function switchAmbient() {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (ambient) {
    const old = ambient;
    old.out.gain.setTargetAtTime(0, t, 0.5);
    setTimeout(() => old.stops.forEach(stop => stop()), 2500);
  }
  ambient = buildAmbient(scene);
  ambient.out.gain.setTargetAtTime(1, t, 0.8);
  scheduleBells();
}

export function unlock() {
  ensureContext();
  if (!ambient) switchAmbient();
}

export function setScene(name) {
  if (scene === name) return;
  scene = name;
  if (ctx) switchAmbient();
}

export function setMuted(value) {
  muted = value;
  localStorage.setItem('pensieveMuted', value ? '1' : '0');
  if (master) master.gain.setTargetAtTime(value ? 0 : volume, ctx.currentTime, 0.15);
  // autostarted playback may still bypass the graph — the master bus can't silence it
  if (value) {
    for (const track of new Set(Object.values(TRACKS))) {
      if (!track.node && !track.el.paused) track.el.pause();
    }
  }
  if (!value) scheduleBells();
}

export function setVolume(value) {
  volume = Math.min(Math.max(value, 0), 1);
  localStorage.setItem('pensieveVolume', String(volume));
  if (master) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.1);
  // autostarted playback bypasses the graph — scale the element directly
  for (const track of new Set(Object.values(TRACKS))) {
    if (!track.node && !track.el.paused) track.el.volume = track.level * volume;
  }
}

export function getVolume() {
  return volume;
}

export function isMuted() {
  return muted;
}

export function splash(intensity = 1) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noiseSource();
  const filter = biquad('lowpass', 1400);
  filter.frequency.setValueAtTime(1400, t);
  filter.frequency.exponentialRampToValueAtTime(220, t + 0.7);
  const env = envelope(t, 0.28 * intensity, 0.02, 0.8);
  src.connect(filter).connect(env);
  output(env);
  src.start(t);
  src.stop(t + 1);

  const bloop = osc('sine', 240);
  bloop.frequency.setValueAtTime(240, t);
  bloop.frequency.exponentialRampToValueAtTime(70, t + 0.35);
  const bloopEnv = envelope(t, 0.14 * intensity, 0.02, 0.5);
  bloop.connect(bloopEnv);
  output(bloopEnv, false);
  bloop.start(t);
  bloop.stop(t + 0.6);
}

export function whoosh(duration = 2.4) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noiseSource();
  const filter = biquad('bandpass', 180);
  filter.Q.value = 1.1;
  filter.frequency.setValueAtTime(180, t);
  filter.frequency.exponentialRampToValueAtTime(1600, t + duration * 0.45);
  filter.frequency.exponentialRampToValueAtTime(300, t + duration);
  const env = envelope(t, 0.3, duration * 0.35, duration);
  src.connect(filter).connect(env);
  output(env);
  src.start(t);
  src.stop(t + duration + 0.1);
}

export function chime() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = osc('sine', 620);
  o.frequency.setValueAtTime(620, t);
  o.frequency.exponentialRampToValueAtTime(1240, t + 0.5);
  const env = envelope(t, 0.07, 0.03, 1.1);
  o.connect(env);
  output(env);
  o.start(t);
  o.stop(t + 1.2);
  bell(987.8, 2.4, 0.05);
}

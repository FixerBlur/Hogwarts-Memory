import { t } from './i18n.js';

const $ = id => document.getElementById(id);

const overlays = ['intro', 'choice', 'write-modal', 'memory-view'];

/* Quill that follows the caret while writing a memory. Nib is at (2, 44). */
const QUILL_SVG = `
<svg width="44" height="46" viewBox="0 0 44 46" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="quill-ink" x1="8" y1="40" x2="38" y2="4" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#26262b"/>
      <stop offset="0.55" stop-color="#101014"/>
      <stop offset="1" stop-color="#2e2e34"/>
    </linearGradient>
  </defs>
  <path d="M2 44 C4.5 41 7 38.2 9.5 35.6 L11.3 37.2 C8.6 39.6 5.8 41.9 2 44 Z" fill="#8a8f99"/>
  <path d="M2 44 L6.2 39.4" stroke="#3c4046" stroke-width="0.8"/>
  <path d="M9 36
           C 6.5 28, 10 19, 16 12.5
           C 22 6, 31 1.5, 37.5 2.5
           C 41.5 3.3, 42.5 7, 40 9
           C 38.3 10.4, 36 9.8, 35.6 8
           C 33 11, 34 13, 31 15.5
           L 32.8 17
           C 28.5 21, 26 22.5, 21.5 25.5
           L 23.2 27.4
           C 19 30.5, 15 33.2, 11 35.8
           Z" fill="url(#quill-ink)"/>
  <path d="M9.5 35.6 C 14 30, 22 20, 30 12 C 33 9, 36 6, 39.5 4.5"
        stroke="#4a4a52" stroke-width="1.1" stroke-linecap="round" stroke-opacity="0.9"/>
  <path d="M13 30 C 17 24, 23 17, 29 11" stroke="#6a6e78" stroke-width="0.8" stroke-opacity="0.5"/>
</svg>`;

const MIRROR_PROPS = [
  'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'letterSpacing',
  'lineHeight', 'textTransform', 'wordSpacing', 'textIndent', 'boxSizing',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'width',
];

function initQuill() {
  const form = $('write-form');
  const quill = document.createElement('div');
  quill.id = 'quill';
  quill.innerHTML = QUILL_SVG;
  form.appendChild(quill);
  const art = quill.firstElementChild;

  // Hidden clone of the field's text — the caret lands where the marker span ends up.
  const mirror = document.createElement('div');
  mirror.id = 'quill-mirror';
  document.body.appendChild(mirror);

  function caretInField(field) {
    const cs = getComputedStyle(field);
    for (const p of MIRROR_PROPS) mirror.style[p] = cs[p];
    if (field.tagName === 'TEXTAREA') {
      mirror.style.whiteSpace = 'pre-wrap';
      mirror.style.overflowWrap = 'break-word';
    } else {
      mirror.style.whiteSpace = 'pre';
      mirror.style.width = 'auto';
    }
    mirror.textContent = field.value.slice(0, field.selectionStart ?? field.value.length);
    const marker = document.createElement('span');
    marker.textContent = '​';
    mirror.appendChild(marker);
    return {
      x: marker.offsetLeft - field.scrollLeft,
      y: marker.offsetTop + marker.offsetHeight - field.scrollTop,
    };
  }

  let restTimer = null;
  function update(field, scribble) {
    const { x, y } = caretInField(field);
    const formRect = form.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    quill.style.left = `${fieldRect.left - formRect.left + form.scrollLeft + x - 2}px`;
    quill.style.top = `${fieldRect.top - formRect.top + form.scrollTop + y - 44}px`;
    if (scribble) {
      quill.classList.add('writing');
      quill.classList.remove('idle');
      art.animate([
        { transform: 'rotate(0deg)' },
        { transform: 'rotate(-7deg) translate(0.6px, -0.6px)' },
        { transform: 'rotate(3deg)' },
        { transform: 'rotate(0deg)' },
      ], { duration: 150, easing: 'ease-out' });
    } else if (!quill.classList.contains('writing')) {
      quill.classList.add('idle');
    }
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      quill.classList.remove('writing');
      quill.classList.add('idle');
    }, 900);
  }

  for (const field of [$('w-author'), $('w-title'), $('w-body')]) {
    field.addEventListener('input', () => update(field, true));
    field.addEventListener('focus', () => update(field, false));
    field.addEventListener('click', () => update(field, false));
    field.addEventListener('keyup', e => {
      if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') update(field, false);
    });
    field.addEventListener('blur', () => {
      clearTimeout(restTimer);
      quill.classList.remove('writing', 'idle');
    });
    if (field.tagName === 'TEXTAREA') {
      field.addEventListener('scroll', () => update(field, false));
    }
  }
}

export function showOverlay(id) {
  for (const o of overlays) $(o).classList.toggle('visible', o === id);
}

const loader = {
  real: 0,
  shown: 0,
  startTs: performance.now(),
  lastTs: performance.now(),
  hideWhenFull: false,
};

function loaderTick(ts) {
  const dt = Math.min((ts - loader.lastTs) / 1000, 0.05);
  loader.lastTs = ts;
  const elapsed = (ts - loader.startTs) / 1000;
  const creep = Math.min(0.85, elapsed * 0.5);
  const target = loader.hideWhenFull ? 1 : Math.max(loader.real, creep);
  const speed = loader.hideWhenFull ? 1.8 : 0.7;
  loader.shown = Math.min(target, loader.shown + speed * dt);
  $('loader-fill').style.height = `${Math.max(6, loader.shown * 100)}%`;
  if (loader.hideWhenFull && loader.shown >= 0.999) {
    $('loader').classList.add('done');
    return;
  }
  requestAnimationFrame(loaderTick);
}
requestAnimationFrame(loaderTick);

export function setLoadProgress(ratio) {
  loader.real = Math.max(loader.real, ratio);
}

export function hideLoader(force = false) {
  if (force) {
    $('loader').classList.add('done');
    return;
  }
  loader.hideWhenFull = true;
}

export function toast(text, ms = 2600) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), ms);
}

export function flash(on) {
  $('flash').classList.toggle('on', on);
}

export function showMemory(memory) {
  $('m-author').textContent = memory.author;
  $('m-date').textContent = (memory.created_at || '').slice(0, 10);
  $('m-title').textContent = memory.title;
  $('m-body').textContent = memory.body;
  showOverlay('memory-view');
}

export function bindUI(handlers) {
  initQuill();
  $('approach-btn').onclick = handlers.onApproach;
  $('back-btn').onclick = handlers.onRetreat;
  $('write-btn').onclick = handlers.onOpenWrite;
  $('dive-btn').onclick = handlers.onDive;
  $('another-btn').onclick = handlers.onAnotherMemory;
  $('surface-btn').onclick = handlers.onSurface;
  $('write-cancel').onclick = handlers.onCancelWrite;

  $('write-form').onsubmit = async e => {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    const errEl = $('write-error');
    errEl.textContent = '';
    try {
      await handlers.onSubmitMemory({
        author: $('w-author').value.trim() || t('author.anon'),
        title: $('w-title').value,
        body: $('w-body').value,
      });
      $('write-form').reset();
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  };
}

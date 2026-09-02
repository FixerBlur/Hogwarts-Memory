/* Tiny i18n. Elements declare their keys via data-i18n (textContent),
   data-i18n-html (innerHTML, for strings with markup), data-i18n-ph
   (placeholder) and data-i18n-title (title). The chosen language persists
   in localStorage. */

const DICT = {
  uk: {
    'app.title': "Омут пам'яті",
    'loader.hint': 'Збираємо спогади…',
    'intro.subtitle': "Кам'яна чаша, що зберігає чужі спогади.<br>" +
      'Підійди ближче — і вирішуй: залишити свій чи зазирнути в чужий.',
    'btn.approach': 'Підійти до Омуту',
    'choice.hint': 'Срібляста поверхня тихо вирує…',
    'btn.write': '🪶 Залишити свій спогад',
    'btn.dive': '🌀 Пірнути в чужий спогад',
    'btn.back': 'Відійти',
    'write.title': 'Новий спогад',
    'write.hint': 'Чорнило зачароване — приймає лише щирі спогади',
    'write.name': "Твоє ім'я",
    'write.nameNote': '(можна лишити порожнім)',
    'write.titleLabel': 'Назва спогаду',
    'write.titlePh': 'Про що цей спогад?',
    'write.body': 'Сам спогад',
    'write.bodyPh': 'Опиши його так, ніби витягуєш сріблясту нитку з думок…',
    'btn.submit': 'Опустити у чашу',
    'btn.cancel': 'Передумав',
    'memory.by': 'Спогад',
    'memory.translated': 'автопереклад',
    'btn.another': 'Інший спогад',
    'btn.surface': 'Виринути',
    'toast.deposited': '✨ Твій спогад розчинився у сріблястій воді',
    'card.label': 'спогад',
    'author.anon': 'Невідомий чарівник',
    'err.server': 'Помилка сервера',
    'err.missing_fields': 'Потрібні і назва, і сам спогад.',
    'err.too_long': 'Спогад задовгий для чаші.',
    'err.empty': 'Омут порожній — ще ніхто не залишив спогадів.',
    'err.rate_limited': 'Забагато спогадів поспіль — зачекай трохи.',
    'sound.title': 'Звук',
    'sound.volume': 'Гучність',
    'dev.title': 'Сайт розробника',
    'lang.toggle': 'EN',
    'lang.title': 'Перемкнути на англійську',
  },
  en: {
    'app.title': 'The Pensieve',
    'loader.hint': 'Gathering memories…',
    'intro.subtitle': "A stone basin that keeps other people's memories.<br>" +
      'Come closer and decide: leave your own, or glimpse into another’s.',
    'btn.approach': 'Approach the Pensieve',
    'choice.hint': 'The silvery surface swirls quietly…',
    'btn.write': '🪶 Leave your memory',
    'btn.dive': '🌀 Dive into a memory',
    'btn.back': 'Step away',
    'write.title': 'A New Memory',
    'write.hint': 'The ink is enchanted — it takes only honest memories',
    'write.name': 'Your name',
    'write.nameNote': '(you may leave it blank)',
    'write.titleLabel': 'Title of the memory',
    'write.titlePh': 'What is this memory about?',
    'write.body': 'The memory itself',
    'write.bodyPh': 'Describe it as though you were drawing a silvery thread out of your thoughts…',
    'btn.submit': 'Lower into the basin',
    'btn.cancel': 'Never mind',
    'memory.by': 'A memory by',
    'memory.translated': 'auto-translated',
    'btn.another': 'Another memory',
    'btn.surface': 'Surface',
    'toast.deposited': '✨ Your memory dissolved into the silvery water',
    'card.label': 'a memory',
    'author.anon': 'Unknown wizard',
    'err.server': 'Server error',
    'err.missing_fields': 'Both a title and the memory itself are needed.',
    'err.too_long': 'That memory is too long for the basin.',
    'err.empty': 'The Pensieve is empty — no one has left a memory yet.',
    'err.rate_limited': 'Too many memories at once — wait a little.',
    'sound.title': 'Sound',
    'sound.volume': 'Volume',
    'dev.title': "Developer's site",
    'lang.toggle': 'УКР',
    'lang.title': 'Switch to Ukrainian',
  },
};

const storedLang = localStorage.getItem('pensieveLang');
let lang = DICT[storedLang] ? storedLang : 'uk';

export function t(key, fallback = key) {
  return DICT[lang][key] ?? fallback;
}

export function current() {
  return lang;
}

function applyDom() {
  document.documentElement.lang = lang;
  document.title = t('app.title');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
}

export function toggle() {
  lang = lang === 'uk' ? 'en' : 'uk';
  localStorage.setItem('pensieveLang', lang);
  applyDom();
}

/* Visitors from Ukraine get Ukrainian, everyone else English — but only
   until they pick a language themselves: an explicit choice is persisted
   and always wins over geo detection. */
async function detectLanguage() {
  try {
    const res = await fetch('/api/geo');
    const { country } = await res.json();
    if (country && country !== 'UA' && lang !== 'en') {
      lang = 'en';
      applyDom();
    }
  } catch {
    // offline / local run without the API — keep the default
  }
}

export function init() {
  applyDom();
  if (!DICT[storedLang]) detectLanguage();
}

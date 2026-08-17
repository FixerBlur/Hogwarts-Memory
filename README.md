# Омут пам'яті (Pensieve)

3D-вебзастосунок за мотивами «Гаррі Поттера». У залі Гоґвортсу стоїть
кам'яна чаша з рунами — Омут пам'яті. Відвідувач може залишити власний
спогад (він опускається в чашу сяючою ниткою) або пірнути в чашу:
камера пролітає крізь вихор у простір спогадів, де серед туману кружляють
картки-історії, і випадкова з них розгортається текстом зі спільної бази.

Графіка: Three.js, PBR-текстури (Poly Haven / ambientCG, CC0),
HDRI-освітлення, м'які тіні, bloom. Всі залежності та асети локальні —
застосунок працює без доступу до інтернету.

## Запуск

Linux / macOS:

```bash
./start.sh
```

Windows — подвійний клік по `start.bat` або з термінала:

```bash
start.bat
```

Або вручну:

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python seed.py    # стартові спогади для порожньої бази
./venv/bin/python app.py     # http://localhost:8000
```

## Структура

```
app.py                        точка входу (Flask, порт 8000)
admin.html                    адмінка (роздається лише за /adminer)
seed.py                       наповнення порожньої бази (25 історій)
start.sh / start.bat          запуск на POSIX / Windows
server/
  __init__.py                 фабрика застосунку, секрети, маршрут /adminer
  db.py                       SQLite-сховище (data/pensieve.db)
  routes.py                   JSON API + захищені admin-ендпоінти
data/                         база, пароль адмінки, ключ сесій (не публікувати!)
public/
  index.html                  розмітка та оверлеї інтерфейсу
  css/
    style.css                 базові (десктопні) стилі
    responsive.css            телефони, тач, короткі екрани, safe-area
  js/
    main.js                   стани, камера, хореографії, зв'язок сцен з UI
    api.js                    клієнт API (локалізація помилок за кодами)
    ui.js                     DOM-оверлеї, лоадер, перо-курсор у формі
    i18n.js                   словник uk/en, data-i18n прив'язки
    core/
      tween.js                твіни, easing, rand
      postprocessing.js       композер із bloom
      fx.js                   спільні шейдери, частинки, промені, канвас-текстури
      audio.js                WebAudio: треки сцен, ембієнти, sfx, гучність
    scenes/
      hall/                   зала: кімната, чаша, реквізит, сніч, анімація палички
      realm/                  простір спогадів і картки-історії
      vortex/                 тунель-переліт між сценами
  assets/                     текстури, HDRI, музика (assets/audio), референс
  vendor/                     Three.js r160, постпроцесинг, RGBELoader
```

## API

| Метод  | Шлях                          | Опис                                  |
|--------|-------------------------------|---------------------------------------|
| POST   | `/api/memories`               | `{author?, title, body}` — новий запис |
| GET    | `/api/memories/random?exclude=<id>` | випадковий спогад, крім `exclude` |
| GET    | `/api/memories/count`         | кількість спогадів                     |
| GET    | `/api/admin/memories`         | всі спогади (для адмінки)              |
| DELETE | `/api/admin/memories/<id>`    | видалити спогад                        |

Адмінка: `http://localhost:8000/adminer` — список усіх спогадів із видаленням.
Захищена паролем: локально він генерується при першому запуску і лежить у
`data/admin_password.txt` (можна замінити на свій — перезапусти сервер).
Сесію підписує ключ із `data/secret_key.txt`. Тека `data/` в `.gitignore`.

## Деплой на Vercel

Локально застосунок працює на SQLite і файлах у `data/`; на Vercel файлова
система read-only, тож база і секрети живуть зовні:

1. Запуш репозиторій на GitHub та імпортуй проєкт у Vercel
   (Framework Preset: **Other** — статика роздається з `public/`,
   Flask загорнутий у serverless-функцію `api/index.py`).
2. У вкладці **Storage** підключи Postgres (Neon з Marketplace, безкоштовний
   тариф) — Vercel сам додасть змінну `DATABASE_URL`.
3. У **Settings → Environment Variables** додай:
   - `ADMIN_PASSWORD` — пароль адмінки;
   - `SECRET_KEY` — довільний довгий випадковий рядок (підпис сесій);
   - `DEEPL_API_KEY` *(опційно)* — ключ DeepL API Free
     (реєстрація на deepl.com → API → Free): вмикає автопереклад спогадів
     англійською для іноземних відвідувачів. Переклади кешуються в базі,
     тож кожен спогад витрачає ліміт лише раз. Без ключа спогади просто
     показуються мовою оригіналу.
4. Наповни продакшен-базу стартовими історіями зі свого компʼютера:

   ```bash
   set DATABASE_URL=<рядок підключення з Vercel> && venv\Scripts\python seed.py
   ```

`server/db.py` сам обирає бекенд: є `DATABASE_URL` — Postgres, немає — SQLite.

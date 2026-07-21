# Мой день

Статичное PWA-приложение (HTML/CSS/JS) без сборки и без пакетного менеджера.
Подробности продукта — в `PROJECT_PASSPORT.md`, правила разработки — в `PROJECT_RULES.md`.

## Cursor Cloud specific instructions

- Это чисто статический сайт: нет `package.json`, нет шага сборки, нет автотестов и линтеров. Устанавливать зависимости не нужно.
- Единственная зависимость среды — Python 3 (уже установлен) для локального статического сервера.
- Запуск dev-сервера: `python3 -m http.server 8000 --bind 127.0.0.1`, затем открыть `http://127.0.0.1:8000/index.html`. Не открывать через `file://`.
- Точки входа: `index.html` (главный экран), `calendar.html`, `day.html`, `profile.html`, `birthdays.html`, `important-dates.html`.
- Данные хранятся в `localStorage` браузера (например ключ `my-day-date-tasks-v1`). Серверного бэкенда/БД нет.
- Файл `Запустить Мой день.cmd` — только для Windows; в облачной среде используйте команду `python3 -m http.server` выше.

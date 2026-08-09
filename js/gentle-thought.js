(function () {
  "use strict";

  var DATA_URL = "assets/data/wisdom.json";
  var EMPTY_TEXT = "Тихая мысль скоро появится.";
  var ERROR_TEXT = "Сегодня можно не спешить.";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";

  var CATEGORIES = {
    default: "default",
    birthday: "birthday",
    holiday: "holiday",
    season: "season",
    weather: "weather",
    weekday: "weekday",
    relationships: "relationships",
    reflection: "reflection",
    joy: "joy",
    support: "support",
    evening: "evening"
  };

  var CATEGORY_PRIORITY = [
    CATEGORIES.birthday,
    CATEGORIES.holiday,
    CATEGORIES.weather,
    CATEGORIES.weekday,
    CATEGORIES.season,
    CATEGORIES.default
  ];

  var ALLOWED_CATEGORIES = {};
  Object.keys(CATEGORIES).forEach(function (key) {
    ALLOWED_CATEGORIES[CATEGORIES[key]] = true;
  });

  function loadGentleThoughtsData() {
    try {
      var request = new XMLHttpRequest();
      request.open("GET", DATA_URL, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300 && request.responseText) {
        var parsed = JSON.parse(request.responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray(parsed.items)) {
          return { status: "ok", data: parsed };
        }
      }

      return { status: "error", data: null };
    } catch (error) {
      console.warn("Не удалось загрузить тихую мысль:", error);
      return { status: "error", data: null };
    }
  }

  function normalizeCategory(value) {
    if (typeof value !== "string") return CATEGORIES.default;
    var category = value.trim();
    if (!category || !ALLOWED_CATEGORIES[category]) return CATEGORIES.default;
    return category;
  }

  function normalizeItems(rawItems) {
    var out = [];
    if (!Array.isArray(rawItems)) return out;

    for (var i = 0; i < rawItems.length; i += 1) {
      var item = rawItems[i];

      if (typeof item === "string") {
        var plain = item.trim();
        if (!plain) continue;
        out.push({ text: plain, category: CATEGORIES.default });
        continue;
      }

      if (!item || typeof item !== "object") continue;

      var text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) continue;

      out.push({
        text: text,
        category: normalizeCategory(item.category)
      });
    }

    return out;
  }

  function getDayIndex(date) {
    var y = date.getFullYear();
    var m = date.getMonth();
    var d = date.getDate();
    return Math.floor(Date.UTC(y, m, d) / 86400000);
  }

  function pickTextForDate(items, date) {
    if (!items.length) return null;
    var dayIndex = getDayIndex(date);
    var index = Math.abs(dayIndex) % items.length;
    return items[index].text;
  }

  function filterByCategory(items, category) {
    var out = [];
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].category === category) out.push(items[i]);
    }
    return out;
  }

  function isTodayBirthdayDate(birthDate, today) {
    var match = typeof birthDate === "string" && birthDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!match) return false;
    return (
      Number(match[1]) === today.getMonth() + 1 &&
      Number(match[2]) === today.getDate()
    );
  }

  function hasBirthdayToday(today) {
    try {
      var saved = localStorage.getItem(BIRTHDAYS_KEY);
      if (!saved) return false;
      var parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return false;

      for (var i = 0; i < parsed.length; i += 1) {
        var birthday = parsed[i];
        if (birthday && isTodayBirthdayDate(birthday.birthDate, today)) return true;
      }
      return false;
    } catch (error) {
      console.warn("Не удалось проверить дни рождения для мысли:", error);
      return false;
    }
  }

  function hasHolidayToday(today) {
    try {
      if (!window.MyDayHolidays || typeof window.MyDayHolidays.getHolidayOnDate !== "function") {
        return false;
      }
      // holidays-ru ожидает месяц 0-based (внутри делает month + 1).
      return !!window.MyDayHolidays.getHolidayOnDate(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
    } catch (error) {
      console.warn("Не удалось проверить праздник для мысли:", error);
      return false;
    }
  }

  function isSpecialWeather(now) {
    if (!now || typeof now !== "object") return false;

    var condition = typeof now.condition === "string" ? now.condition : "";
    if (
      condition === "rain" ||
      condition === "thunderstorm" ||
      condition === "snow" ||
      condition === "fog"
    ) {
      return true;
    }

    if (typeof now.temp === "number" && isFinite(now.temp)) {
      if (now.temp >= 28 || now.temp <= -10) return true;
    }

    return false;
  }

  function hasSpecialWeatherToday() {
    try {
      if (!window.MyDayWeather || typeof window.MyDayWeather.loadWeather !== "function") {
        return false;
      }
      var weather = window.MyDayWeather.loadWeather();
      if (!weather || weather.status !== "ok") return false;
      return isSpecialWeather(weather.now);
    } catch (error) {
      console.warn("Не удалось проверить погоду для мысли:", error);
      return false;
    }
  }

  function isCategoryActive(category, today) {
    if (category === CATEGORIES.birthday) return hasBirthdayToday(today);
    if (category === CATEGORIES.holiday) return hasHolidayToday(today);
    if (category === CATEGORIES.season) return true;
    if (category === CATEGORIES.weather) return hasSpecialWeatherToday();
    if (category === CATEGORIES.weekday) return true;
    if (category === CATEGORIES.default) return true;
    return false;
  }

  function resolveCategory(items, today) {
    for (var i = 0; i < CATEGORY_PRIORITY.length; i += 1) {
      var category = CATEGORY_PRIORITY[i];
      if (!isCategoryActive(category, today)) continue;
      var pool = filterByCategory(items, category);
      if (pool.length) return category;
    }
    return CATEGORIES.default;
  }

  function pickThoughtForToday(items, today) {
    var category = resolveCategory(items, today);
    var pool = filterByCategory(items, category);
    if (!pool.length) {
      pool = filterByCategory(items, CATEGORIES.default);
    }
    if (!pool.length) return null;
    return pickTextForDate(pool, today);
  }

  function renderGentleThought() {
    var textEl = document.getElementById("gentle-thought-text");
    if (!textEl) return;

    var loaded = loadGentleThoughtsData();
    if (loaded.status !== "ok" || !loaded.data) {
      textEl.textContent = ERROR_TEXT;
      return;
    }

    var items = normalizeItems(loaded.data.items);
    if (!items.length) {
      textEl.textContent = EMPTY_TEXT;
      return;
    }

    var thought = pickThoughtForToday(items, new Date());
    if (!thought) {
      textEl.textContent = EMPTY_TEXT;
      return;
    }

    textEl.textContent = thought;
  }

  function init() {
    renderGentleThought();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

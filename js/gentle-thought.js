(function () {
  "use strict";

  var DATA_URL = "assets/data/wisdom.json?v=categories-full-1";
  var EMPTY_TEXT = "Тихая мысль скоро появится.";
  var ERROR_TEXT = "Сегодня можно не спешить.";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var YEAR_STATE_KEY = "my-day-gentle-thought-year-v1";

  var CATEGORIES = {
    default: "default",
    birthday: "birthday",
    newyear: "newyear",
    march8: "march8",
    feb23: "feb23",
    vacation: "vacation",
    dayoff: "dayoff",
    rain: "rain",
    snow: "snow",
    cloudy: "cloudy",
    heat: "heat",
    frost: "frost",
    sunny: "sunny",
    wind: "wind",
    thunderstorm: "thunderstorm",
    warm: "warm",
    cool: "cool",
    monday: "monday",
    tuesday: "tuesday",
    wednesday: "wednesday",
    thursday: "thursday",
    friday: "friday",
    saturday: "saturday",
    sunday: "sunday",
    spring: "spring",
    summer: "summer",
    autumn: "autumn",
    winter: "winter"
  };

  // Специальные события (жёсткий приоритет).
  var SPECIAL_EVENT_PRIORITY = [
    CATEGORIES.birthday,
    CATEGORIES.newyear,
    CATEGORIES.march8,
    CATEGORIES.feb23,
    CATEGORIES.vacation,
    CATEGORIES.thunderstorm,
    CATEGORIES.rain,
    CATEGORIES.snow,
    CATEGORIES.frost,
    CATEGORIES.heat,
    CATEGORIES.wind,
    CATEGORIES.dayoff
  ];

  var ORDINARY_WEATHER_CATEGORIES = [
    CATEGORIES.sunny,
    CATEGORIES.cloudy,
    CATEGORIES.warm,
    CATEGORIES.cool
  ];

  var WEEKDAY_BY_INDEX = [
    CATEGORIES.sunday,
    CATEGORIES.monday,
    CATEGORIES.tuesday,
    CATEGORIES.wednesday,
    CATEGORIES.thursday,
    CATEGORIES.friday,
    CATEGORIES.saturday
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

  function formatDateKey(date) {
    var y = date.getFullYear();
    var m = date.getMonth() + 1;
    var d = date.getDate();
    return (
      y +
      "-" +
      (m < 10 ? "0" : "") +
      m +
      "-" +
      (d < 10 ? "0" : "") +
      d
    );
  }

  function emptyYearState(year) {
    return {
      year: year,
      shown: [],
      lastDate: null,
      lastText: null,
      lastCategory: null
    };
  }

  function loadYearState(year) {
    try {
      var raw = localStorage.getItem(YEAR_STATE_KEY);
      if (!raw) return emptyYearState(year);

      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return emptyYearState(year);
      }

      if (parsed.year !== year) {
        return emptyYearState(year);
      }

      var shown = [];
      if (Array.isArray(parsed.shown)) {
        for (var i = 0; i < parsed.shown.length; i += 1) {
          if (typeof parsed.shown[i] === "string" && parsed.shown[i]) {
            shown.push(parsed.shown[i]);
          }
        }
      }

      return {
        year: year,
        shown: shown,
        lastDate: typeof parsed.lastDate === "string" ? parsed.lastDate : null,
        lastText: typeof parsed.lastText === "string" ? parsed.lastText : null,
        lastCategory:
          typeof parsed.lastCategory === "string" ? parsed.lastCategory : null
      };
    } catch (error) {
      console.warn("Не удалось загрузить состояние тихой мысли:", error);
      return emptyYearState(year);
    }
  }

  function saveYearState(state) {
    try {
      localStorage.setItem(YEAR_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Не удалось сохранить состояние тихой мысли:", error);
    }
  }

  function excludeShown(items, shown) {
    if (!Array.isArray(items) || !items.length) return [];
    if (!Array.isArray(shown) || !shown.length) return items.slice();

    var seen = {};
    for (var i = 0; i < shown.length; i += 1) {
      seen[shown[i]] = true;
    }

    var out = [];
    for (var j = 0; j < items.length; j += 1) {
      if (!seen[items[j].text]) out.push(items[j]);
    }
    return out;
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

  function getQueryParam(name) {
    try {
      var search = String(window.location.search || "");
      if (!search) return null;
      if (search.charAt(0) === "?") search = search.slice(1);
      var pairs = search.split("&");
      for (var i = 0; i < pairs.length; i += 1) {
        if (!pairs[i]) continue;
        var parts = pairs[i].split("=");
        var key = parts[0] ? decodeURIComponent(parts[0]).trim() : "";
        if (key !== name) continue;
        return parts[1] ? decodeURIComponent(parts[1].replace(/\+/g, " ")).trim() : "";
      }
    } catch (error) {
      return null;
    }
    return null;
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

  function hasOfficialHolidayToday(today) {
    try {
      if (!window.MyDayHolidays || typeof window.MyDayHolidays.getHolidayOnDate !== "function") {
        return false;
      }
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

  function isNewYearDay(today) {
    var m = today.getMonth();
    var d = today.getDate();
    // 31 декабря и 1–8 января (новогодние каникулы)
    if (m === 11 && d === 31) return true;
    if (m === 0 && d >= 1 && d <= 8) return true;
    return false;
  }

  function isMarch8(today) {
    return today.getMonth() === 2 && today.getDate() === 8;
  }

  function isFeb23(today) {
    return today.getMonth() === 1 && today.getDate() === 23;
  }

  function isNamedHolidayToday(today) {
    return isNewYearDay(today) || isMarch8(today) || isFeb23(today);
  }

  function hasVacationSignal() {
    // Пока нет продуктового сигнала отпуска — только явный тест: ?wisdom=vacation
    return getQueryParam("wisdom") === "vacation";
  }

  function isDayOffToday(today) {
    // Официальный выходной/праздник, кроме уже покрытых newyear/march8/feb23
    if (isNamedHolidayToday(today)) return false;
    return hasOfficialHolidayToday(today);
  }

  function loadWeatherNow() {
    try {
      if (!window.MyDayWeather || typeof window.MyDayWeather.loadWeather !== "function") {
        return null;
      }
      var weather = window.MyDayWeather.loadWeather();
      if (!weather || weather.status !== "ok" || !weather.now) return null;
      return weather;
    } catch (error) {
      console.warn("Не удалось проверить погоду для мысли:", error);
      return null;
    }
  }

  function getWeatherCategory(today) {
    var weather = loadWeatherNow();
    if (!weather) return null;

    var now = weather.now;
    var condition = typeof now.condition === "string" ? now.condition : "";
    var temp = typeof now.temp === "number" && isFinite(now.temp) ? now.temp : null;
    var windIncreases = !!(weather.today && weather.today.windIncreases === true);

    // Специфичные/выраженные условия первыми.
    if (condition === "thunderstorm") return CATEGORIES.thunderstorm;
    if (condition === "rain") return CATEGORIES.rain;
    if (condition === "snow") return CATEGORIES.snow;
    if (temp !== null && temp <= -5) return CATEGORIES.frost;
    if (temp !== null && temp >= 28) return CATEGORIES.heat;
    if (windIncreases) return CATEGORIES.wind;
    if (condition === "fog") return CATEGORIES.cloudy;

    // Обычная погода — ниже season/weekday в приоритете.
    if (condition === "cloudy" || condition === "partly_cloudy") {
      return CATEGORIES.cloudy;
    }
    if (condition === "clear") return CATEGORIES.sunny;
    if (temp !== null && temp >= 18 && temp < 28) return CATEGORIES.warm;
    if (temp !== null && temp >= 5 && temp < 18) return CATEGORIES.cool;

    return null;
  }

  function getWeekdayCategory(today) {
    return WEEKDAY_BY_INDEX[today.getDay()] || null;
  }

  function getSeasonCategory(today) {
    var month = today.getMonth(); // 0–11
    if (month >= 2 && month <= 4) return CATEGORIES.spring;
    if (month >= 5 && month <= 7) return CATEGORIES.summer;
    if (month >= 8 && month <= 10) return CATEGORIES.autumn;
    return CATEGORIES.winter;
  }

  function isCategoryActive(category, today) {
    if (category === CATEGORIES.birthday) return hasBirthdayToday(today);
    if (category === CATEGORIES.newyear) return isNewYearDay(today);
    if (category === CATEGORIES.march8) return isMarch8(today);
    if (category === CATEGORIES.feb23) return isFeb23(today);
    if (category === CATEGORIES.vacation) return hasVacationSignal();
    if (category === CATEGORIES.dayoff) return isDayOffToday(today);

    if (
      category === CATEGORIES.thunderstorm ||
      category === CATEGORIES.rain ||
      category === CATEGORIES.snow ||
      category === CATEGORIES.frost ||
      category === CATEGORIES.heat ||
      category === CATEGORIES.wind ||
      category === CATEGORIES.cloudy ||
      category === CATEGORIES.sunny ||
      category === CATEGORIES.warm ||
      category === CATEGORIES.cool
    ) {
      return getWeatherCategory(today) === category;
    }

    if (
      category === CATEGORIES.monday ||
      category === CATEGORIES.tuesday ||
      category === CATEGORIES.wednesday ||
      category === CATEGORIES.thursday ||
      category === CATEGORIES.friday ||
      category === CATEGORIES.saturday ||
      category === CATEGORIES.sunday
    ) {
      return getWeekdayCategory(today) === category;
    }

    if (
      category === CATEGORIES.spring ||
      category === CATEGORIES.summer ||
      category === CATEGORIES.autumn ||
      category === CATEGORIES.winter
    ) {
      return getSeasonCategory(today) === category;
    }

    if (category === CATEGORIES.default) return true;
    return false;
  }

  function isOrdinaryWeatherCategory(category) {
    for (var i = 0; i < ORDINARY_WEATHER_CATEGORIES.length; i += 1) {
      if (ORDINARY_WEATHER_CATEGORIES[i] === category) return true;
    }
    return false;
  }

  function collectActiveOrdinaryCategories(items, today) {
    var active = [];
    var candidates = [];
    var season = getSeasonCategory(today);
    var weekday = getWeekdayCategory(today);
    var weatherCat = getWeatherCategory(today);
    var i;
    var category;

    if (season) candidates.push(season);
    if (weekday) candidates.push(weekday);
    candidates.push(CATEGORIES.default);

    if (weatherCat && isOrdinaryWeatherCategory(weatherCat)) {
      candidates.push(weatherCat);
    }

    for (i = 0; i < candidates.length; i += 1) {
      category = candidates[i];
      if (filterByCategory(items, category).length > 0) {
        active.push(category);
      }
    }

    return active;
  }

  function resolveSpecialCategory(items, today) {
    for (var i = 0; i < SPECIAL_EVENT_PRIORITY.length; i += 1) {
      var category = SPECIAL_EVENT_PRIORITY[i];
      if (!isCategoryActive(category, today)) continue;
      var pool = filterByCategory(items, category);
      if (pool.length) return category;
    }
    return null;
  }

  function pickOrdinaryThought(items, today, shown) {
    var activeCategories = collectActiveOrdinaryCategories(items, today);
    var dayIndex = getDayIndex(today);
    var i;
    var category;
    var unused;

    if (activeCategories.length) {
      var start = Math.abs(dayIndex) % activeCategories.length;
      for (i = 0; i < activeCategories.length; i += 1) {
        category = activeCategories[(start + i) % activeCategories.length];
        unused = excludeShown(filterByCategory(items, category), shown);
        if (unused.length) {
          return {
            category: category,
            text: pickTextForDate(unused, today)
          };
        }
      }
    }

    // default — запасной пул неиспользованных
    unused = excludeShown(filterByCategory(items, CATEGORIES.default), shown);
    if (unused.length) {
      return {
        category: CATEGORIES.default,
        text: pickTextForDate(unused, today)
      };
    }

    // Повтор полного пула только когда все подходящие исчерпаны
    if (activeCategories.length) {
      category = activeCategories[Math.abs(dayIndex) % activeCategories.length];
      var fullPool = filterByCategory(items, category);
      if (fullPool.length) {
        return {
          category: category,
          text: pickTextForDate(fullPool, today)
        };
      }
    }

    var defaultPool = filterByCategory(items, CATEGORIES.default);
    if (defaultPool.length) {
      return {
        category: CATEGORIES.default,
        text: pickTextForDate(defaultPool, today)
      };
    }

    return null;
  }

  function pickThoughtForToday(items, today) {
    var year = today.getFullYear();
    var dateKey = formatDateKey(today);
    var state = loadYearState(year);

    if (state.lastDate === dateKey && state.lastText) {
      return {
        category: state.lastCategory || CATEGORIES.default,
        text: state.lastText
      };
    }

    var shown = state.shown;
    var result = null;

    var specialCategory = resolveSpecialCategory(items, today);
    if (specialCategory) {
      var specialUnused = excludeShown(
        filterByCategory(items, specialCategory),
        shown
      );
      if (specialUnused.length) {
        result = {
          category: specialCategory,
          text: pickTextForDate(specialUnused, today)
        };
      }
      // если спец-пул исчерпан — обычный путь, другие special не пробуем
    }

    if (!result) {
      result = pickOrdinaryThought(items, today, shown);
    }

    if (!result || !result.text) return null;

    state.year = year;
    state.lastDate = dateKey;
    state.lastText = result.text;
    state.lastCategory = result.category;
    if (shown.indexOf(result.text) === -1) {
      state.shown = shown.concat([result.text]);
    }
    saveYearState(state);

    return result;
  }

  function getSelectedDate() {
    var target = window.MyDayTargetDate;
    if (target && target instanceof Date && !isNaN(target.getTime())) {
      return target;
    }

    var raw = getQueryParam("date");
    if (!raw) return new Date();

    var match = String(raw).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var preview = new Date(year, month - 1, day);

    if (
      preview.getFullYear() !== year ||
      preview.getMonth() !== month - 1 ||
      preview.getDate() !== day
    ) {
      return new Date();
    }

    return preview;
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

    var thought = pickThoughtForToday(items, getSelectedDate());
    if (!thought || !thought.text) {
      textEl.textContent = EMPTY_TEXT;
      return;
    }

    textEl.textContent = thought.text;
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

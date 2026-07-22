(function (window) {
  "use strict";

  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var DEFAULT_CITY = "Екатеринбург";
  var EMPTY_TEXT = "Погода пока недоступна";
  var ERROR_TEXT = "Не удалось загрузить погоду";
  var WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

  // Режимы местоположения: сейчас только profile.
  // geo и manual зарезервированы для следующих задач.
  var LOCATION_MODE = {
    PROFILE: "profile",
    GEO: "geo",
    MANUAL: "manual"
  };

  var CONDITIONS = {
    clear: { label: "Ясно", icon: "☀" },
    partly_cloudy: { label: "Переменная облачность", icon: "⛅" },
    cloudy: { label: "Облачно", icon: "☁" },
    rain: { label: "Дождь", icon: "🌧" },
    snow: { label: "Снег", icon: "❄" },
    fog: { label: "Туман", icon: "🌫" },
    thunderstorm: { label: "Гроза", icon: "⛈" }
  };

  function getQueryParam(name) {
    var search = "";
    try {
      search = String(window.location.search || "");
    } catch (error) {
      search = "";
    }

    if (!search) {
      try {
        var href = String(window.location.href || "");
        var qIndex = href.indexOf("?");
        if (qIndex !== -1) {
          var hashIndex = href.indexOf("#", qIndex);
          search = hashIndex === -1 ? href.slice(qIndex) : href.slice(qIndex, hashIndex);
        }
      } catch (error2) {
        search = "";
      }
    }

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

    return null;
  }

  function loadUserSettings() {
    try {
      var saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (!saved) return {};

      var parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить профиль для погоды:", error);
      return {};
    }
  }

  function getProfileCity() {
    var settings = loadUserSettings();
    return typeof settings.city === "string" && settings.city.trim()
      ? settings.city.trim()
      : DEFAULT_CITY;
  }

  function resolveLocation() {
    return {
      mode: LOCATION_MODE.PROFILE,
      city: getProfileCity()
    };
  }

  function formatTemp(temp) {
    if (typeof temp !== "number" || !isFinite(temp)) return "";
    var rounded = Math.round(temp);
    return (rounded > 0 ? "+" : "") + String(rounded) + "°";
  }

  function normalizeCondition(code) {
    if (typeof code !== "string") return null;
    return Object.prototype.hasOwnProperty.call(CONDITIONS, code) ? code : null;
  }

  function getTimeOfDay(date) {
    var hour = date.getHours();
    if (hour < 5) return "night";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  function isWeekend(date) {
    var day = date.getDay();
    return day === 0 || day === 6;
  }

  function getWeekendLabel(date) {
    return date.getDay() === 6 ? "суббота" : "воскресенье";
  }

  function isHolidayToday(date) {
    if (!window.MyDayHolidays || typeof window.MyDayHolidays.getHolidayOnDate !== "function") {
      return false;
    }

    try {
      return !!window.MyDayHolidays.getHolidayOnDate(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
    } catch (error) {
      return false;
    }
  }

  function formatLocalDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return year + "-" + month + "-" + day;
  }

  function formatCityLabel(city) {
    var value = typeof city === "string" && city.trim() ? city.trim() : DEFAULT_CITY;
    return "📍 " + value;
  }

  function formatNowCondition(label) {
    if (typeof label !== "string" || !label.trim()) return "";
    var text = label.trim();
    return "Сейчас " + text.charAt(0).toLowerCase() + text.slice(1);
  }

  function setPhraseText(tipEl, phrase) {
    if (!tipEl) return;
    tipEl.textContent = "";
    if (typeof phrase !== "string" || !phrase) return;

    var parts = phrase.split("\n");
    for (var i = 0; i < parts.length; i += 1) {
      if (i > 0) tipEl.appendChild(document.createElement("br"));
      tipEl.appendChild(document.createTextNode(parts[i]));
    }
  }

  function pickPhrase(candidates, date) {
    if (!candidates || !candidates.length) return "";
    var seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
    return candidates[Math.abs(seed) % candidates.length] || "";
  }

  function isPrecipCondition(condition) {
    return condition === "rain" || condition === "thunderstorm" || condition === "snow";
  }

  function normalizeToday(rawToday, now) {
    if (!rawToday || typeof rawToday !== "object") {
      return {
        laterCondition: null,
        eveningTemp: null,
        windIncreases: false
      };
    }

    var laterCondition = normalizeCondition(rawToday.laterCondition);
    if (laterCondition && now && laterCondition === now.condition) {
      laterCondition = null;
    }

    var eveningTemp = typeof rawToday.eveningTemp === "number" && isFinite(rawToday.eveningTemp)
      ? rawToday.eveningTemp
      : null;

    return {
      laterCondition: laterCondition,
      eveningTemp: eveningTemp,
      windIncreases: rawToday.windIncreases === true
    };
  }

  // Существенные изменения только до конца сегодняшнего дня.
  function getTodayChange(now, today, date) {
    if (!now || !today) return null;

    var timeOfDay = getTimeOfDay(date);
    var dayStillOpen = timeOfDay === "morning" || timeOfDay === "afternoon";
    if (!dayStillOpen) return null;

    var later = today.laterCondition;
    if (later === "rain" || later === "thunderstorm") {
      return { type: "later_rain" };
    }
    if (later === "snow") {
      return { type: "later_snow" };
    }

    if (today.windIncreases) {
      return { type: "later_wind" };
    }

    if (
      typeof today.eveningTemp === "number" &&
      typeof now.temp === "number" &&
      now.temp - today.eveningTemp >= 5
    ) {
      return { type: "cooler_evening" };
    }

    if (
      typeof today.eveningTemp === "number" &&
      typeof now.temp === "number" &&
      today.eveningTemp - now.temp >= 5
    ) {
      return { type: "warmer_later" };
    }

    return null;
  }

  function buildPhraseFromChange(change) {
    if (!change) return "";

    if (change.type === "later_rain") {
      return "После обеда возможен дождь.\nЗонт сегодня не будет лишним.";
    }
    if (change.type === "later_snow") {
      return "К вечеру возможен снег.\nОденьтесь потеплее.";
    }
    if (change.type === "later_wind") {
      return "Во второй половине дня усилится ветер.";
    }
    if (change.type === "cooler_evening") {
      return "К вечеру станет прохладнее.";
    }
    if (change.type === "warmer_later") {
      return "К середине дня станет теплее.";
    }

    return "";
  }

  // Стабильный день: позитивные формулировки только по сегодняшним данным.
  function buildPhraseStableDay(now, today, date) {
    if (!now || typeof now.temp !== "number") return "";

    var condition = now.condition;
    var temp = now.temp;
    var candidates = [];
    var precipLater = today && isPrecipCondition(today.laterCondition);
    var stableNoPrecip = !isPrecipCondition(condition) && !precipLater;

    if (temp >= 28) {
      candidates.push("Сегодня будет жарко.\nВозьмите с собой воду.");
    } else if (temp <= -10) {
      candidates.push("На улице морозно.\nПерчатки точно пригодятся.");
    } else if (temp <= 0) {
      candidates.push("Холодновато.\nКуртка сегодня к месту.");
    }

    if (condition === "clear" && stableNoPrecip) {
      candidates.push("Сегодня весь день солнечно.\nОтличная погода для прогулки.");
      candidates.push("Сегодня будет ясно.");
    } else if (condition === "partly_cloudy" && stableNoPrecip) {
      candidates.push("Сегодня будет переменная облачность.\nХороший день для спокойных дел.");
    } else if (condition === "cloudy" && stableNoPrecip) {
      candidates.push("Сегодня будет облачно.\nСпокойный день без лишней суеты.");
    }

    if (condition === "rain" || condition === "thunderstorm") {
      candidates.push("Сегодня дождливо.\nЗонт лучше держать под рукой.");
    }

    if (condition === "snow") {
      candidates.push("Сегодня снежно.\nПусть день будет тёплым внутри.");
    }

    if (condition === "fog") {
      candidates.push("Сегодня туманно.\nВыйдите чуть раньше обычного.");
    }

    if (isHolidayToday(date)) {
      candidates.push("Сегодня праздничный день.\nМожно чуть спокойнее обычного.");
    } else if (isWeekend(date)) {
      candidates.push(
        "Сегодня " + getWeekendLabel(date) + ".\nМожно позволить себе никуда не спешить."
      );
    }

    if (!candidates.length) {
      candidates.push("Сегодня спокойный день.\nБерегите себя.");
    }

    return pickPhrase(candidates, date);
  }

  // Одна фраза: что важно знать о сегодняшнем дне.
  function buildPhrase(now, today, date) {
    var change = getTodayChange(now, today, date);
    var changePhrase = buildPhraseFromChange(change);
    if (changePhrase) return changePhrase;
    return buildPhraseStableDay(now, today, date);
  }

  function buildMockForecast(fromDate) {
    var samples = [
      { condition: "clear", temp: 24 },
      { condition: "partly_cloudy", temp: 22 },
      { condition: "rain", temp: 19 },
      { condition: "cloudy", temp: 21 },
      { condition: "clear", temp: 23 }
    ];
    var forecast = [];

    for (var i = 0; i < samples.length; i += 1) {
      var day = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate() + i + 1);
      var sample = samples[i];
      forecast.push({
        date: formatLocalDate(day),
        weekday: WEEKDAYS_SHORT[day.getDay()],
        condition: sample.condition,
        icon: CONDITIONS[sample.condition].icon,
        temp: sample.temp
      });
    }

    return forecast;
  }

  // Локальный mock-провайдер без внешнего API.
  // Тест: index.html?weather=empty | index.html?weather=error
  function fetchWeatherData(location) {
    var mode = getQueryParam("weather");
    var city = location && location.city ? location.city : DEFAULT_CITY;

    if (mode === "empty") {
      return { status: "empty", location: location };
    }

    if (mode === "error") {
      return { status: "error", location: location };
    }

    var nowDate = new Date();
    var condition = "clear";
    var meta = CONDITIONS[condition];
    var forecast = buildMockForecast(nowDate);

    return {
      status: "ok",
      location: {
        mode: location.mode || LOCATION_MODE.PROFILE,
        city: city
      },
      now: {
        temp: 21,
        condition: condition,
        label: meta.label,
        icon: meta.icon
      },
      // Ход сегодняшнего дня согласован с now (стабильный солнечный день).
      today: {
        laterCondition: null,
        eveningTemp: 19,
        windIncreases: false
      },
      forecast: forecast
    };
  }

  function normalizeForecast(rawForecast) {
    if (!Array.isArray(rawForecast)) return [];

    var result = [];
    for (var i = 0; i < rawForecast.length && result.length < 5; i += 1) {
      var item = rawForecast[i];
      if (!item || typeof item !== "object") continue;

      var condition = normalizeCondition(item.condition);
      if (!condition || typeof item.temp !== "number" || !isFinite(item.temp)) continue;

      var meta = CONDITIONS[condition];
      var weekday = typeof item.weekday === "string" && item.weekday.trim()
        ? item.weekday.trim()
        : "";

      if (!weekday && typeof item.date === "string") {
        var parsed = new Date(item.date + "T12:00:00");
        if (!isNaN(parsed.getTime())) {
          weekday = WEEKDAYS_SHORT[parsed.getDay()];
        }
      }

      if (!weekday) continue;

      result.push({
        date: typeof item.date === "string" ? item.date : "",
        weekday: weekday,
        condition: condition,
        icon: meta.icon,
        temp: item.temp
      });
    }

    return result;
  }

  function loadWeather() {
    var location = resolveLocation();
    var nowDate = new Date();

    try {
      var data = fetchWeatherData(location);
      if (!data || typeof data !== "object") {
        return { status: "empty", location: location };
      }

      if (data.status === "empty" || data.status === "error") {
        return {
          status: data.status,
          location: data.location && typeof data.location === "object"
            ? data.location
            : location
        };
      }

      var now = data.now && typeof data.now === "object" ? data.now : null;
      var condition = now ? normalizeCondition(now.condition) : null;
      if (!now || !condition || typeof now.temp !== "number" || !isFinite(now.temp)) {
        return { status: "empty", location: location };
      }

      var meta = CONDITIONS[condition];
      var forecast = normalizeForecast(data.forecast);
      var resolvedLocation = data.location && typeof data.location === "object"
        ? {
            mode: data.location.mode || location.mode,
            city: typeof data.location.city === "string" && data.location.city.trim()
              ? data.location.city.trim()
              : location.city
          }
        : location;

      var weatherNow = {
        temp: now.temp,
        condition: condition,
        label: meta.label,
        icon: meta.icon
      };
      var today = normalizeToday(data.today, weatherNow);

      return {
        status: "ok",
        location: resolvedLocation,
        now: weatherNow,
        today: today,
        phrase: buildPhrase(weatherNow, today, nowDate),
        forecast: forecast
      };
    } catch (error) {
      console.warn("Не удалось загрузить погоду:", error);
      return { status: "error", location: location };
    }
  }

  function renderForecast(container, forecast) {
    if (!container) return;
    container.textContent = "";

    if (!Array.isArray(forecast) || !forecast.length) return;

    for (var i = 0; i < forecast.length; i += 1) {
      var day = forecast[i];
      var dayEl = document.createElement("div");
      dayEl.className = "weather__day";

      var nameEl = document.createElement("span");
      nameEl.className = "weather__day-name";
      nameEl.textContent = day.weekday;

      var iconEl = document.createElement("span");
      iconEl.className = "weather__day-icon";
      iconEl.setAttribute("aria-hidden", "true");
      iconEl.textContent = day.icon;

      var tempEl = document.createElement("span");
      tempEl.className = "weather__day-temp";
      tempEl.textContent = formatTemp(day.temp);

      dayEl.appendChild(nameEl);
      dayEl.appendChild(iconEl);
      dayEl.appendChild(tempEl);
      container.appendChild(dayEl);
    }
  }

  function renderWeather() {
    var iconEl = document.getElementById("weather-icon");
    var cityEl = document.getElementById("weather-city");
    var tempEl = document.getElementById("weather-temp");
    var condEl = document.getElementById("weather-cond");
    var tipEl = document.getElementById("weather-tip");
    var forecastEl = document.getElementById("weather-forecast");

    if (!cityEl && !tempEl && !condEl && !tipEl && !forecastEl) return;

    var weather = loadWeather();
    var city = weather.location && weather.location.city
      ? weather.location.city
      : DEFAULT_CITY;

    if (cityEl) cityEl.textContent = formatCityLabel(city);

    if (weather.status === "error") {
      if (iconEl) iconEl.textContent = "";
      if (tempEl) tempEl.textContent = "";
      if (condEl) condEl.textContent = ERROR_TEXT;
      setPhraseText(tipEl, "");
      renderForecast(forecastEl, []);
      return;
    }

    if (weather.status !== "ok") {
      if (iconEl) iconEl.textContent = "";
      if (tempEl) tempEl.textContent = "";
      if (condEl) condEl.textContent = EMPTY_TEXT;
      setPhraseText(tipEl, "");
      renderForecast(forecastEl, []);
      return;
    }

    if (iconEl) iconEl.textContent = weather.now.icon || "";
    if (tempEl) tempEl.textContent = formatTemp(weather.now.temp);
    if (condEl) condEl.textContent = formatNowCondition(weather.now.label);
    setPhraseText(tipEl, weather.phrase || "");
    renderForecast(forecastEl, weather.forecast);
  }

  function init() {
    renderWeather();
  }

  window.MyDayWeather = {
    loadWeather: loadWeather,
    renderWeather: renderWeather,
    CONDITIONS: CONDITIONS,
    LOCATION_MODE: LOCATION_MODE
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);

(function (window) {
  "use strict";

  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var DEFAULT_CITY = "Екатеринбург";
  var EMPTY_TEXT = "Погода пока недоступна";
  var ERROR_TEXT = "Не удалось загрузить погоду";

  var CONDITIONS = {
    clear: {
      label: "Ясно",
      detail: "Без осадков",
      tip: "Сегодня можно\nбез зонта"
    },
    partly_cloudy: {
      label: "Переменная облачность",
      detail: "Возможен краткий дождь",
      tip: "Зонт\nна всякий случай"
    },
    cloudy: {
      label: "Облачно",
      detail: "Без осадков",
      tip: "День\nспокойный"
    },
    rain: {
      label: "Дождь",
      detail: "Ожидаются осадки",
      tip: "Лучше\nвзять зонт"
    },
    snow: {
      label: "Снег",
      detail: "Ожидается снег",
      tip: "Оденьтесь\nпотеплее"
    },
    fog: {
      label: "Туман",
      detail: "Видимость снижена",
      tip: "Будьте\nосторожны"
    },
    thunderstorm: {
      label: "Гроза",
      detail: "Возможен сильный дождь",
      tip: "Лучше\nостаться дома"
    }
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

  function formatTemp(temp) {
    if (typeof temp !== "number" || !isFinite(temp)) return "";
    var rounded = Math.round(temp);
    return (rounded > 0 ? "+" : "") + String(rounded) + "°";
  }

  function normalizeCondition(code) {
    if (typeof code !== "string") return null;
    return Object.prototype.hasOwnProperty.call(CONDITIONS, code) ? code : null;
  }

  // Локальный mock-провайдер без внешнего API.
  // Тест: index.html?weather=empty | index.html?weather=error
  function fetchWeatherData(city) {
    var mode = getQueryParam("weather");

    if (mode === "empty") {
      return { status: "empty", city: city };
    }

    if (mode === "error") {
      return { status: "error", city: city };
    }

    var condition = "clear";
    var meta = CONDITIONS[condition];

    return {
      status: "ok",
      city: city,
      temp: 21,
      condition: condition,
      label: meta.label,
      detail: meta.detail,
      tip: meta.tip
    };
  }

  function loadWeather() {
    var city = getProfileCity();

    try {
      var data = fetchWeatherData(city);
      if (!data || typeof data !== "object") {
        return { status: "empty", city: city };
      }

      if (data.status === "empty" || data.status === "error") {
        return {
          status: data.status,
          city: typeof data.city === "string" && data.city.trim() ? data.city.trim() : city
        };
      }

      var condition = normalizeCondition(data.condition);
      if (!condition || typeof data.temp !== "number" || !isFinite(data.temp)) {
        return { status: "empty", city: city };
      }

      var meta = CONDITIONS[condition];
      return {
        status: "ok",
        city: typeof data.city === "string" && data.city.trim() ? data.city.trim() : city,
        temp: data.temp,
        condition: condition,
        label: meta.label,
        detail: meta.detail,
        tip: meta.tip
      };
    } catch (error) {
      console.warn("Не удалось загрузить погоду:", error);
      return { status: "error", city: city };
    }
  }

  function setTipText(tipEl, tip) {
    if (!tipEl) return;

    tipEl.textContent = "";
    if (typeof tip !== "string" || !tip) return;

    var parts = tip.split("\n");
    for (var i = 0; i < parts.length; i += 1) {
      if (i > 0) tipEl.appendChild(document.createElement("br"));
      tipEl.appendChild(document.createTextNode(parts[i]));
    }
  }

  function renderWeather() {
    var cityEl = document.getElementById("weather-city");
    var tempEl = document.getElementById("weather-temp");
    var condEl = document.getElementById("weather-cond");
    var detailEl = document.getElementById("weather-detail");
    var tipEl = document.getElementById("weather-tip");

    if (!cityEl && !tempEl && !condEl && !detailEl && !tipEl) return;

    var weather = loadWeather();

    if (cityEl) {
      cityEl.textContent = weather.city || DEFAULT_CITY;
    }

    if (weather.status === "error") {
      if (tempEl) tempEl.textContent = "";
      if (condEl) condEl.textContent = ERROR_TEXT;
      if (detailEl) detailEl.textContent = "";
      setTipText(tipEl, "");
      return;
    }

    if (weather.status !== "ok") {
      if (tempEl) tempEl.textContent = "";
      if (condEl) condEl.textContent = EMPTY_TEXT;
      if (detailEl) detailEl.textContent = "";
      setTipText(tipEl, "");
      return;
    }

    if (tempEl) tempEl.textContent = formatTemp(weather.temp);
    if (condEl) condEl.textContent = weather.label;
    if (detailEl) detailEl.textContent = weather.detail;
    setTipText(tipEl, weather.tip);
  }

  function init() {
    renderWeather();
  }

  window.MyDayWeather = {
    loadWeather: loadWeather,
    renderWeather: renderWeather,
    CONDITIONS: CONDITIONS
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window);

(function (window) {
  "use strict";

  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var EMPTY_TEXT = "Погода пока недоступна";
  var ERROR_TEXT = "Не удалось загрузить погоду";
  var FORECAST_UNAVAILABLE_TEXT = "Прогноз пока недоступен";
  var HISTORY_UNAVAILABLE_TEXT = "Погода за эту дату недоступна";
  var WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  var WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
  var MAX_FORECAST_DAYS = 16;
  var weatherPromise = null;
  var inFlightKey = null;
  var cachedWeather = null;
  var cachedKey = null;
  var weatherLoadedAt = 0;
  var geoCoordsInFlight = null;
  var geoPlaceLabels = {};
  var geoPlaceInFlight = {};

  // Режимы местоположения: profile и geo активны.
  // manual зарезервирован для следующих задач.
  var LOCATION_MODE = {
    PROFILE: "profile",
    GEO: "geo",
    MANUAL: "manual"
  };

  var GEO_LABEL = "Ваше местоположение";
  var GEO_OPTIONS = {
    timeout: 15000,
    enableHighAccuracy: false,
    maximumAge: WEATHER_CACHE_TTL_MS
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
      : "";
  }

  function roundCoord(n) {
    if (typeof n !== "number" || !isFinite(n)) return null;
    return Number(n.toFixed(2));
  }

  function hasGeoCoords(location) {
    return !!(
      location &&
      location.mode === LOCATION_MODE.GEO &&
      typeof location.latitude === "number" &&
      isFinite(location.latitude) &&
      typeof location.longitude === "number" &&
      isFinite(location.longitude)
    );
  }

  function logGeoFail(error) {
    var code = error && typeof error.code === "number" ? error.code : null;
    var message = error && typeof error.message === "string" ? error.message : "";
    try {
      console.debug("Weather geo fail", { code: code, message: message });
    } catch (debugError) {}
  }

  function requestBrowserPosition() {
    return new Promise(function (resolve) {
      try {
        if (
          !navigator.geolocation ||
          typeof navigator.geolocation.getCurrentPosition !== "function"
        ) {
          resolve({ coords: null, error: null });
          return;
        }

        navigator.geolocation.getCurrentPosition(
          function (position) {
            try {
              var coords = position && position.coords;
              var latitude = coords ? roundCoord(coords.latitude) : null;
              var longitude = coords ? roundCoord(coords.longitude) : null;
              if (latitude === null || longitude === null) {
                resolve({ coords: null, error: null });
                return;
              }
              resolve({
                coords: {
                  latitude: latitude,
                  longitude: longitude
                },
                error: null
              });
            } catch (error) {
              resolve({ coords: null, error: null });
            }
          },
          function (error) {
            resolve({ coords: null, error: error || null });
          },
          GEO_OPTIONS
        );
      } catch (error) {
        resolve({ coords: null, error: null });
      }
    });
  }

  function getBrowserCoordinates() {
    if (geoCoordsInFlight) return geoCoordsInFlight;

    geoCoordsInFlight = requestBrowserPosition().then(function (first) {
      if (first.coords) return first.coords;
      if (first.error) logGeoFail(first.error);
      if (!first.error || first.error.code !== 3) return null;

      return requestBrowserPosition().then(function (second) {
        if (second.coords) return second.coords;
        if (second.error) logGeoFail(second.error);
        return null;
      });
    }).then(function (coords) {
      geoCoordsInFlight = null;
      return coords;
    });

    return geoCoordsInFlight;
  }

  function resolveLocation() {
    return getBrowserCoordinates().then(function (coords) {
      if (coords) {
        return {
          mode: LOCATION_MODE.GEO,
          city: GEO_LABEL,
          latitude: coords.latitude,
          longitude: coords.longitude
        };
      }

      var city = getProfileCity();
      if (city) {
        return {
          mode: LOCATION_MODE.PROFILE,
          city: city
        };
      }

      return {
        mode: LOCATION_MODE.GEO,
        city: "",
        latitude: null,
        longitude: null
      };
    });
  }

  function keepMissingGeoCoords(target, source) {
    if (!target || typeof target !== "object" || !hasGeoCoords(source)) {
      return target;
    }
    if (typeof target.latitude !== "number" || !isFinite(target.latitude)) {
      target.latitude = source.latitude;
    }
    if (typeof target.longitude !== "number" || !isFinite(target.longitude)) {
      target.longitude = source.longitude;
    }
    return target;
  }

  function isUsableSettlementValue(value, address) {
    if (typeof value !== "string") return false;
    var text = value.trim();
    if (text.length < 2) return false;
    if (text === GEO_LABEL) return false;
    if (/^\d+$/.test(text)) return false;
    if (/^\d[\d\s-]{2,}$/.test(text)) return false;
    if (/^[A-Za-z]{2}-[A-Za-z0-9]{1,8}$/.test(text)) return false;
    if (/^[a-z]{2}$/.test(text)) return false;
    if (!address || typeof address !== "object") return true;
    var blocked = [
      address.country,
      address.country_code,
      address.state,
      address.region,
      address.county,
      address.postcode,
      address.house_number
    ];
    for (var i = 0; i < blocked.length; i += 1) {
      if (typeof blocked[i] === "string" && blocked[i].trim() === text) {
        return false;
      }
    }
    return true;
  }

  function pickGeoSettlementName(data) {
    if (!data || typeof data !== "object") return "";

    var address = data.address;
    var primary = ["city", "town", "village", "municipality", "hamlet", "city_district"];
    var secondary = [
      "suburb",
      "quarter",
      "neighbourhood",
      "neighborhood",
      "locality",
      "isolated_dwelling",
      "borough"
    ];
    var skipKeys = {
      country: true,
      country_code: true,
      continent: true,
      state: true,
      state_district: true,
      region: true,
      county: true,
      postcode: true,
      house_number: true,
      house_name: true,
      road: true,
      pedestrian: true,
      path: true,
      footway: true,
      cycleway: true,
      building: true,
      amenity: true,
      shop: true,
      office: true,
      tourism: true,
      leisure: true,
      historic: true,
      man_made: true,
      aeroway: true,
      railway: true,
      craft: true,
      emergency: true,
      healthcare: true,
      military: true,
      natural: true,
      waterway: true,
      landuse: true,
      ref: true
    };
    var seen = {};
    var i;
    var key;
    var value;
    var text;
    var keys;
    var skipValues;
    var tokens;

    if (address && typeof address === "object") {
      for (i = 0; i < primary.length; i += 1) {
        value = address[primary[i]];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }

      for (i = 0; i < secondary.length; i += 1) {
        value = address[secondary[i]];
        if (isUsableSettlementValue(value, address)) {
          return value.trim();
        }
      }

      for (i = 0; i < primary.length; i += 1) seen[primary[i]] = true;
      for (i = 0; i < secondary.length; i += 1) seen[secondary[i]] = true;

      keys = Object.keys(address);
      for (i = 0; i < keys.length; i += 1) {
        key = keys[i];
        if (seen[key] || skipKeys[key] || /^ISO3166/i.test(key)) continue;
        value = address[key];
        if (isUsableSettlementValue(value, address)) {
          return value.trim();
        }
      }
    }

    if (typeof data.display_name !== "string") return "";
    tokens = data.display_name.split(",");
    skipValues = {};
    if (address && typeof address === "object") {
      keys = ["country", "state", "region", "county", "postcode", "country_code", "house_number"];
      for (i = 0; i < keys.length; i += 1) {
        value = address[keys[i]];
        if (typeof value === "string" && value.trim()) {
          skipValues[value.trim()] = true;
        }
      }
      keys = Object.keys(address);
      for (i = 0; i < keys.length; i += 1) {
        if (!/^ISO3166/i.test(keys[i])) continue;
        value = address[keys[i]];
        if (typeof value === "string" && value.trim()) {
          skipValues[value.trim()] = true;
        }
      }
    }
    for (i = 0; i < tokens.length; i += 1) {
      text = tokens[i].trim();
      if (!text || skipValues[text]) continue;
      if (isUsableSettlementValue(text, address)) {
        return text;
      }
    }
    return "";
  }

  function lookupGeoPlaceName(lat, lon) {
    var key = String(lat) + "|" + String(lon);

    if (Object.prototype.hasOwnProperty.call(geoPlaceLabels, key)) {
      return Promise.resolve(geoPlaceLabels[key]);
    }

    if (geoPlaceInFlight[key]) {
      return geoPlaceInFlight[key];
    }

    var requestPromise = new Promise(function (resolve) {
      var controller = null;
      var timeoutId = null;
      var settled = false;

      function finish(name) {
        if (settled) return;
        settled = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        var cached = typeof name === "string" ? name : "";
        geoPlaceLabels[key] = cached;
        delete geoPlaceInFlight[key];
        resolve(cached);
      }

      try {
        if (typeof AbortController === "function") {
          controller = new AbortController();
        }

        timeoutId = setTimeout(function () {
          try {
            if (controller) controller.abort();
          } catch (error) {}
          finish("");
        }, 3000);

        var url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
          encodeURIComponent(String(lat)) +
          "&lon=" +
          encodeURIComponent(String(lon)) +
          "&zoom=10&addressdetails=1&accept-language=ru";

        var fetchOptions = {};
        if (controller) {
          fetchOptions.signal = controller.signal;
        }

        fetch(url, fetchOptions).then(function (response) {
          if (!response || !response.ok) {
            finish("");
            return;
          }
          return response.json().then(function (data) {
            finish(pickGeoSettlementName(data) || "");
          });
        }).catch(function () {
          finish("");
        });
      } catch (error) {
        finish("");
      }
    });

    geoPlaceInFlight[key] = requestPromise;
    return requestPromise;
  }

  function applyGeoPlaceLabel(location, name) {
    if (!name) return;
    if (!hasGeoCoords(location)) return;

    location.city = name;

    if (
      cachedWeather &&
      cachedWeather.location &&
      hasGeoCoords(cachedWeather.location) &&
      cachedWeather.location.latitude === location.latitude &&
      cachedWeather.location.longitude === location.longitude
    ) {
      cachedWeather.location.city = name;
    }

    var cityEl = document.getElementById("weather-city");
    if (cityEl) {
      cityEl.textContent = formatCityLabel(name);
    }
  }

  function cachedGeoPlaceName(location) {
    if (!hasGeoCoords(location)) return "";
    var key = String(location.latitude) + "|" + String(location.longitude);
    if (!Object.prototype.hasOwnProperty.call(geoPlaceLabels, key)) return "";
    var name = geoPlaceLabels[key];
    return typeof name === "string" && name.trim() ? name.trim() : "";
  }

  function pickResolvedCity(dataCity, location) {
    var snapshot = typeof dataCity === "string" ? dataCity.trim() : "";
    var live = location && typeof location.city === "string" ? location.city.trim() : "";
    if (hasGeoCoords(location)) {
      var cached = cachedGeoPlaceName(location);
      if (cached) return cached;
      if (live && live !== GEO_LABEL) return live;
      if (snapshot && snapshot !== GEO_LABEL) return snapshot;
      return live || snapshot;
    }
    var profileCity = getProfileCity();
    if (profileCity) return profileCity;
    return snapshot || live;
  }

  function applyCachedGeoPlaceIfReady(targetLocation) {
    var name = cachedGeoPlaceName(targetLocation);
    if (name) applyGeoPlaceLabel(targetLocation, name);
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

  function buildWeatherCacheKey(location, date) {
    var dateKey = formatLocalDate(date);
    if (hasGeoCoords(location)) {
      return "geo|" + location.latitude + "|" + location.longitude + "|" + dateKey;
    }

    var city = location && typeof location.city === "string" ? location.city.trim() : "";
    return "profile|" + city + "|" + dateKey;
  }

  function getDateOnlyValue(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function getDateMode(date) {
    var selectedValue = getDateOnlyValue(date);
    var todayValue = getDateOnlyValue(new Date());
    if (selectedValue === todayValue) return "current";
    return selectedValue < todayValue ? "historical" : "forecast";
  }

  function getDaysFromToday(date) {
    return Math.round((getDateOnlyValue(date) - getDateOnlyValue(new Date())) / 86400000);
  }

  function formatCityLabel(city) {
    if (typeof city === "string" && city.trim()) {
      return "📍 " + city.trim();
    }
    return "📍 Укажите город";
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

  function hasPrecipAmount(value) {
    return typeof value === "number" && isFinite(value) && value > 0;
  }

  function hasRainSignal(condition, precipitation, rain, showers) {
    if (condition === "rain" || condition === "thunderstorm") return true;
    if (condition === "snow") return false;

    return hasPrecipAmount(rain) ||
      hasPrecipAmount(showers) ||
      hasPrecipAmount(precipitation);
  }

  function normalizeToday(rawToday, now) {
    if (!rawToday || typeof rawToday !== "object") {
      return {
        laterCondition: null,
        laterConditionTime: null,
        eveningTemp: null,
        windIncreases: false
      };
    }

    var laterCondition = normalizeCondition(rawToday.laterCondition);
    var laterConditionTime = typeof rawToday.laterConditionTime === "string" &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rawToday.laterConditionTime)
      ? rawToday.laterConditionTime
      : null;
    if (laterCondition && now && laterCondition === now.condition) {
      laterCondition = null;
      laterConditionTime = null;
    }

    var eveningTemp = typeof rawToday.eveningTemp === "number" && isFinite(rawToday.eveningTemp)
      ? rawToday.eveningTemp
      : null;

    return {
      laterCondition: laterCondition,
      laterConditionTime: laterCondition ? laterConditionTime : null,
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
    if (later && later !== now.condition) {
      return {
        type: "later_condition",
        laterCondition: later,
        laterConditionTime: today.laterConditionTime
      };
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

    if (change.type === "later_condition") {
      var forecastPhrases = {
        rain: "Ожидается дождь.",
        snow: "Ожидается снег.",
        clear: "Погода будет ясной.",
        partly_cloudy: "Ожидается переменная облачность.",
        cloudy: "Будет облачно.",
        fog: "Ожидается туман.",
        thunderstorm: "Ожидается гроза."
      };
      var timedForecastPhrases = {
        rain: "ожидается дождь.",
        snow: "ожидается снег.",
        clear: "погода будет ясной.",
        partly_cloudy: "ожидается переменная облачность.",
        cloudy: "будет облачно.",
        fog: "ожидается туман.",
        thunderstorm: "ожидается гроза."
      };
      if (change.laterConditionTime && timedForecastPhrases[change.laterCondition]) {
        return "После " + change.laterConditionTime + " " +
          timedForecastPhrases[change.laterCondition];
      }
      return forecastPhrases[change.laterCondition] || "";
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

  function conditionFromWeatherCode(code) {
    if (code === 0 || code === 1) return "clear";
    if (code === 2) return "partly_cloudy";
    if (code === 3) return "cloudy";
    if (code === 45 || code === 48) return "fog";
    if (code >= 51 && code <= 67 || code >= 80 && code <= 82) return "rain";
    if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
    if (code >= 95 && code <= 99) return "thunderstorm";
    return null;
  }

  function getJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("Weather request failed: " + response.status);
      return response.json();
    });
  }

  function unavailableWeather(location, dateMode, targetDate, message) {
    return {
      status: "unavailable",
      location: location,
      dateMode: dateMode,
      targetDate: formatLocalDate(targetDate),
      message: message
    };
  }

  function fetchSelectedDateWeather(result, location, city, targetDate, dateMode) {
    var dateKey = formatLocalDate(targetDate);
    var unavailableText = dateMode === "historical"
      ? HISTORY_UNAVAILABLE_TEXT
      : FORECAST_UNAVAILABLE_TEXT;

    if (dateMode === "historical" && dateKey < "1940-01-01") {
      return Promise.resolve(unavailableWeather(location, dateMode, targetDate, unavailableText));
    }

    if (dateMode === "forecast" && getDaysFromToday(targetDate) >= MAX_FORECAST_DAYS) {
      return Promise.resolve(unavailableWeather(location, dateMode, targetDate, unavailableText));
    }

    var apiBase = dateMode === "historical"
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";
    var requestUrl = apiBase + "?latitude=" + result.latitude +
      "&longitude=" + result.longitude +
      "&start_date=" + dateKey +
      "&end_date=" + dateKey +
      "&daily=weather_code,temperature_2m_max&timezone=auto";

    return getJson(requestUrl).then(function (weather) {
      var daily = weather && weather.daily;
      var index = daily && Array.isArray(daily.time) ? daily.time.indexOf(dateKey) : -1;
      var code = index >= 0 && Array.isArray(daily.weather_code)
        ? daily.weather_code[index]
        : null;
      var temp = index >= 0 && Array.isArray(daily.temperature_2m_max)
        ? daily.temperature_2m_max[index]
        : null;
      var condition = conditionFromWeatherCode(code);

      if (!condition || typeof temp !== "number" || !isFinite(temp)) {
        return unavailableWeather(location, dateMode, targetDate, unavailableText);
      }

      return {
        status: "ok",
        location: { mode: location.mode || LOCATION_MODE.PROFILE, city: city },
        dateMode: dateMode,
        targetDate: dateKey,
        now: {
          temp: temp,
          condition: condition,
          label: CONDITIONS[condition].label,
          icon: CONDITIONS[condition].icon
        },
        today: {
          laterCondition: null,
          laterConditionTime: null,
          eveningTemp: null,
          windIncreases: false
        },
        forecast: []
      };
    });
  }

  // Тест: index.html?weather=empty | index.html?weather=error
  function fetchWeatherData(location, targetDate) {
    var mode = getQueryParam("weather");
    var city = location && typeof location.city === "string" ? location.city.trim() : "";
    var dateMode = getDateMode(targetDate);

    if (mode === "empty") {
      return Promise.resolve({ status: "empty", location: location });
    }

    if (mode === "error") {
      return Promise.resolve({ status: "error", location: location });
    }

    var coordsReady;

    if (hasGeoCoords(location)) {
      city = city || GEO_LABEL;
      coordsReady = Promise.resolve({
        latitude: location.latitude,
        longitude: location.longitude
      });
    } else if (city && location && location.mode === LOCATION_MODE.PROFILE) {
      var geocodingUrl = "https://geocoding-api.open-meteo.com/v1/search?name=" +
        encodeURIComponent(city) + "&count=1&language=ru&format=json";

      coordsReady = getJson(geocodingUrl).then(function (geocoding) {
        var result = geocoding && Array.isArray(geocoding.results) ? geocoding.results[0] : null;
        if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
          return null;
        }
        return { latitude: result.latitude, longitude: result.longitude };
      });
    } else {
      return Promise.resolve({
        status: "empty",
        location: location || { mode: LOCATION_MODE.PROFILE, city: "" }
      });
    }

    return coordsReady.then(function (result) {
      if (!result) {
        return { status: "error", location: location };
      }

      if (dateMode !== "current") {
        return fetchSelectedDateWeather(result, location, city, targetDate, dateMode);
      }

      var forecastUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + result.latitude +
        "&longitude=" + result.longitude +
        "&current=temperature_2m,weather_code,wind_speed_10m,precipitation,rain,showers" +
        "&hourly=temperature_2m,weather_code,precipitation,precipitation_probability,rain,showers" +
        "&daily=weather_code,temperature_2m_max,wind_speed_10m_max&forecast_days=6&timezone=auto";

      return getJson(forecastUrl).then(function (weather) {
        var current = weather && weather.current;
        var hourly = weather && weather.hourly;
        var daily = weather && weather.daily;
        var condition = current ? conditionFromWeatherCode(current.weather_code) : null;
        var currentHasRain = current && hasRainSignal(
          condition,
          current.precipitation,
          current.rain,
          current.showers
        );
        if (condition !== "rain" && condition !== "thunderstorm" && condition !== "snow" && currentHasRain) {
          condition = "rain";
        }
        if (
          !current ||
          !hourly ||
          !daily ||
          !condition ||
          typeof current.time !== "string" ||
          !Array.isArray(hourly.time) ||
          !Array.isArray(hourly.temperature_2m) ||
          !Array.isArray(hourly.weather_code) ||
          !Array.isArray(hourly.precipitation) ||
          !Array.isArray(hourly.rain) ||
          !Array.isArray(hourly.showers) ||
          !Array.isArray(daily.time)
        ) {
          return { status: "error", location: location };
        }

        var currentDate = current.time.slice(0, 10);
        var eveningTime = currentDate + "T18:00";
        var eveningTemp = null;
        var laterCondition = null;
        var laterConditionTime = null;
        var firstLaterCondition = null;

        for (var hourIndex = 0; hourIndex < hourly.time.length; hourIndex += 1) {
          var hourTime = hourly.time[hourIndex];
          if (hourTime === eveningTime && current.time < eveningTime) {
            var hourlyTemp = hourly.temperature_2m[hourIndex];
            if (typeof hourlyTemp === "number" && isFinite(hourlyTemp)) {
              eveningTemp = hourlyTemp;
            }
          }

          if (
            typeof hourTime !== "string" ||
            hourTime.slice(0, 10) !== currentDate ||
            hourTime <= current.time
          ) {
            continue;
          }

          var hourlyCondition = conditionFromWeatherCode(hourly.weather_code[hourIndex]);
          var hourlyHasRain = hasRainSignal(
            hourlyCondition,
            hourly.precipitation[hourIndex],
            hourly.rain[hourIndex],
            hourly.showers[hourIndex]
          );

          if (hourlyHasRain && condition !== "rain" && condition !== "thunderstorm") {
            laterCondition = hourlyCondition === "thunderstorm" ? "thunderstorm" : "rain";
            laterConditionTime = hourTime.slice(11, 16);
            break;
          }

          if (!firstLaterCondition && hourlyCondition && hourlyCondition !== condition) {
            firstLaterCondition = {
              condition: hourlyCondition,
              time: hourTime.slice(11, 16)
            };
          }
        }

        if (!laterCondition && firstLaterCondition) {
          laterCondition = firstLaterCondition.condition;
          laterConditionTime = firstLaterCondition.time;
        }

        var forecast = [];
        for (var i = 1; i < daily.time.length && forecast.length < 5; i += 1) {
          var forecastCondition = conditionFromWeatherCode(daily.weather_code[i]);
          if (!forecastCondition || typeof daily.temperature_2m_max[i] !== "number") continue;
          var forecastDate = new Date(daily.time[i] + "T12:00:00");
          forecast.push({
            date: daily.time[i],
            weekday: WEEKDAYS_SHORT[forecastDate.getDay()],
            condition: forecastCondition,
            icon: CONDITIONS[forecastCondition].icon,
            temp: daily.temperature_2m_max[i]
          });
        }

        return {
          status: "ok",
          location: { mode: location.mode || LOCATION_MODE.PROFILE, city: city },
          dateMode: "current",
          targetDate: formatLocalDate(targetDate),
          now: {
            temp: current.temperature_2m,
            condition: condition,
            label: CONDITIONS[condition].label,
            icon: CONDITIONS[condition].icon
          },
          today: {
            laterCondition: laterCondition,
            laterConditionTime: laterConditionTime,
            eveningTemp: eveningTemp,
            windIncreases: typeof current.wind_speed_10m === "number" &&
              typeof daily.wind_speed_10m_max[0] === "number" &&
              daily.wind_speed_10m_max[0] - current.wind_speed_10m >= 10
          },
          forecast: forecast
        };
      });
    });
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

  function loadWeather() {
    var startedCity = getProfileCity();
    var nowDate = getSelectedDate();
    var pendingGeoKey = "geo|pending|" + formatLocalDate(nowDate);

    if (weatherPromise && inFlightKey === pendingGeoKey) return weatherPromise;

    var requestPromise = resolveLocation().then(function (location) {
      if (location.mode === LOCATION_MODE.GEO && !hasGeoCoords(location)) {
        var emptyWeather = {
          status: "empty",
          location: location
        };
        publishWeatherState(emptyWeather);
        return emptyWeather;
      }

      if (hasGeoCoords(location)) {
        lookupGeoPlaceName(location.latitude, location.longitude).then(function (name) {
          if (name) applyGeoPlaceLabel(location, name);
        });
      }

      var requestKey = buildWeatherCacheKey(location, nowDate);

      if (
        cachedWeather &&
        cachedKey === requestKey &&
        Date.now() - weatherLoadedAt < WEATHER_CACHE_TTL_MS
      ) {
        applyCachedGeoPlaceIfReady(cachedWeather.location);
        return cachedWeather;
      }

      return fetchWeatherData(location, nowDate).then(function (data) {
      if (!data || typeof data !== "object") {
        return { status: "empty", location: keepMissingGeoCoords(location, location) };
      }

      if (data.status === "empty" || data.status === "error" || data.status === "unavailable") {
        var statusLocation = data.location && typeof data.location === "object"
          ? data.location
          : location;
        keepMissingGeoCoords(statusLocation, location);
        return {
          status: data.status,
          location: statusLocation,
          dateMode: typeof data.dateMode === "string" ? data.dateMode : getDateMode(nowDate),
          targetDate: typeof data.targetDate === "string"
            ? data.targetDate
            : formatLocalDate(nowDate),
          message: typeof data.message === "string" ? data.message : ""
        };
      }

      var now = data.now && typeof data.now === "object" ? data.now : null;
      var condition = now ? normalizeCondition(now.condition) : null;
      if (!now || !condition || typeof now.temp !== "number" || !isFinite(now.temp)) {
        return { status: "empty", location: keepMissingGeoCoords(location, location) };
      }

      var meta = CONDITIONS[condition];
      var forecast = normalizeForecast(data.forecast);
      var dateMode = typeof data.dateMode === "string" ? data.dateMode : getDateMode(nowDate);
      var resolvedLocation = data.location && typeof data.location === "object"
        ? {
            mode: data.location.mode || location.mode,
            city: pickResolvedCity(
              data.location.city,
              location
            )
          }
        : location;

      if (hasGeoCoords(location)) {
        resolvedLocation.latitude = location.latitude;
        resolvedLocation.longitude = location.longitude;
      }

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
        dateMode: dateMode,
        targetDate: typeof data.targetDate === "string"
          ? data.targetDate
          : formatLocalDate(nowDate),
        now: weatherNow,
        today: today,
        phrase: dateMode === "current" ? buildPhrase(weatherNow, today, nowDate) : "",
        forecast: forecast
      };
    }).catch(function (error) {
      console.warn("Не удалось загрузить погоду:", error);
      return { status: "error", location: keepMissingGeoCoords(location, location) };
    }).then(function (weather) {
      if (getProfileCity() !== startedCity) return loadWeather();

      cachedWeather = weather;
      cachedKey = requestKey;
      weatherLoadedAt = Date.now();
      if (weather && weather.location) {
        applyCachedGeoPlaceIfReady(weather.location);
      }
      publishWeatherState(weather);
      return weather;
    });
    });

    weatherPromise = requestPromise;
    inFlightKey = pendingGeoKey;

    requestPromise.then(clearInFlight, clearInFlight);
    return requestPromise;

    function clearInFlight() {
      if (weatherPromise !== requestPromise) return;
      weatherPromise = null;
      inFlightKey = null;
    }
  }

  function whenReady() {
    return loadWeather();
  }

  function publishWeatherState(weather) {
    var state = {
      status: weather && typeof weather.status === "string" ? weather.status : "empty",
      condition: weather && weather.status === "ok" && weather.dateMode === "current" && weather.now
        ? normalizeCondition(weather.now.condition)
        : null
    };

    document.dispatchEvent(new CustomEvent("myday:weather-state", {
      detail: state
    }));
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

  function goToCitySettings(event) {
    if (getProfileCity()) return;
    if (event && event.type === "keydown") {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.key === " ") event.preventDefault();
    }
    window.location.href = "profile.html#profile-city";
  }

  function setWeatherCityInteractive(cityEl, enabled) {
    if (!cityEl) return;
    if (enabled) {
      cityEl.setAttribute("role", "link");
      cityEl.setAttribute("tabindex", "0");
      if (!cityEl._citySettingsBound) {
        cityEl.addEventListener("click", goToCitySettings);
        cityEl.addEventListener("keydown", goToCitySettings);
        cityEl._citySettingsBound = true;
      }
    } else {
      cityEl.removeAttribute("role");
      cityEl.removeAttribute("tabindex");
      if (cityEl._citySettingsBound) {
        cityEl.removeEventListener("click", goToCitySettings);
        cityEl.removeEventListener("keydown", goToCitySettings);
        cityEl._citySettingsBound = false;
      }
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

    loadWeather().then(function (weather) {
      var profileCity = getProfileCity();
      var location = weather.location && typeof weather.location === "object"
        ? weather.location
        : null;
      var city = location && typeof location.city === "string"
        ? location.city.trim()
        : "";
      var isGeo = !!(location && location.mode === LOCATION_MODE.GEO);
      var validGeo = isGeo && (hasGeoCoords(location) || city === GEO_LABEL || !!city);

      function showEmptyFields(message) {
        if (iconEl) iconEl.textContent = "";
        if (tempEl) tempEl.textContent = "";
        if (condEl) condEl.textContent = message || "";
        setPhraseText(tipEl, "");
        renderForecast(forecastEl, []);
      }

      if (weather.status === "ok") {
        setWeatherCityInteractive(cityEl, false);
        if (cityEl) {
          cityEl.textContent = formatCityLabel(
            isGeo ? (city || GEO_LABEL) : (city || profileCity)
          );
        }
        if (iconEl) iconEl.textContent = weather.now.icon || "";
        if (tempEl) tempEl.textContent = formatTemp(weather.now.temp);
        if (condEl) {
          if (weather.dateMode === "historical") {
            condEl.textContent = "За день: " + weather.now.label.toLowerCase();
          } else if (weather.dateMode === "forecast") {
            condEl.textContent = "Прогноз: " + weather.now.label.toLowerCase();
          } else {
            condEl.textContent = formatNowCondition(weather.now.label);
          }
        }
        setPhraseText(tipEl, weather.phrase || "");
        renderForecast(forecastEl, weather.forecast);
        return;
      }

      if (weather.status === "empty" && !profileCity) {
        if (cityEl) cityEl.textContent = formatCityLabel("");
        setWeatherCityInteractive(cityEl, true);
        showEmptyFields("");
        return;
      }

      if ((weather.status === "error" || weather.status === "unavailable") && validGeo) {
        setWeatherCityInteractive(cityEl, false);
        if (cityEl) cityEl.textContent = formatCityLabel(city || GEO_LABEL);
        showEmptyFields(
          weather.status === "error" ? ERROR_TEXT : (weather.message || EMPTY_TEXT)
        );
        return;
      }

      setWeatherCityInteractive(cityEl, false);
      if (cityEl) cityEl.textContent = formatCityLabel(profileCity || city);

      if (weather.status === "error") {
        showEmptyFields(ERROR_TEXT);
        return;
      }

      if (weather.status === "unavailable") {
        showEmptyFields(weather.message || EMPTY_TEXT);
        return;
      }

      showEmptyFields(EMPTY_TEXT);
    });
  }

  function init() {
    renderWeather();
    window.setInterval(renderWeather, WEATHER_CACHE_TTL_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") renderWeather();
    });
  }

  window.MyDayWeather = {
    loadWeather: loadWeather,
    whenReady: whenReady,
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

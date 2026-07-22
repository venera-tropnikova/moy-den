(function () {
  "use strict";

  var DATA_URL = "thoughts-ru.json";
  var EMPTY_TEXT = "Мысль дня скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить мысль дня.";

  var WEEKDAY_KEYS = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];

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

  function getLocalDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function hashString(value) {
    var hash = 0;
    var text = String(value || "");

    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }

    return hash;
  }

  function normalizeThought(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }

  function collectThoughts(list) {
    if (!Array.isArray(list)) return [];

    var result = [];
    for (var i = 0; i < list.length; i += 1) {
      var text = normalizeThought(list[i]);
      if (text) result.push(text);
    }
    return result;
  }

  function buildPool(data, date) {
    if (!data || typeof data !== "object") return [];

    var weekdayKey = WEEKDAY_KEYS[date.getDay()];
    var weekdayThoughts = collectThoughts(data[weekdayKey]);
    var generalThoughts = collectThoughts(data.general);

    return weekdayThoughts.concat(generalThoughts);
  }

  function pickThoughtForDate(data, date) {
    var pool = buildPool(data, date);
    if (!pool.length) return null;

    var dateKey = getLocalDateKey(date);
    var index = hashString(dateKey) % pool.length;
    return pool[index];
  }

  function loadThoughtsData() {
    try {
      var request = new XMLHttpRequest();
      request.open("GET", DATA_URL, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300 && request.responseText) {
        var parsed = JSON.parse(request.responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return { status: "ok", data: parsed };
        }
      }

      return { status: "error", data: null };
    } catch (error) {
      console.warn("Не удалось загрузить мысли дня:", error);
      return { status: "error", data: null };
    }
  }

  // Тест: index.html?thought=empty | index.html?thought=error
  function resolveThought() {
    var mode = getQueryParam("thought");

    if (mode === "empty") {
      return { status: "empty", text: EMPTY_TEXT };
    }

    if (mode === "error") {
      return { status: "error", text: ERROR_TEXT };
    }

    var loaded = loadThoughtsData();
    if (loaded.status !== "ok") {
      return { status: "error", text: ERROR_TEXT };
    }

    var thought = pickThoughtForDate(loaded.data, new Date());
    if (!thought) {
      return { status: "empty", text: EMPTY_TEXT };
    }

    return { status: "ok", text: thought };
  }

  function renderThought() {
    var moodEl = document.getElementById("mood-text");
    if (!moodEl) return;

    var result = resolveThought();
    moodEl.textContent = result.text;
  }

  function init() {
    renderThought();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

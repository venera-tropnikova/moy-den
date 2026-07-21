(function () {
  "use strict";

  var DATA_URL = "history-events-ru.json";
  var EMPTY_TEXT = "Историческая справка скоро появится.";

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
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

  // Временный тестовый режим: index.html?date=YYYY-MM-DD
  function getHistoryDate() {
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

  function getDateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return month + "-" + day;
  }

  function formatDayMonth(date) {
    return date.getDate() + " " + MONTHS[date.getMonth()];
  }

  function loadHistoryData() {
    try {
      var request = new XMLHttpRequest();
      request.open("GET", DATA_URL, false);
      request.send(null);

      if (request.status >= 200 && request.status < 300 && request.responseText) {
        var parsed = JSON.parse(request.responseText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn("Не удалось загрузить исторические события:", error);
    }

    return null;
  }

  function hasValidSource(sources) {
    if (!Array.isArray(sources) || !sources.length) return false;

    for (var i = 0; i < sources.length; i += 1) {
      var source = sources[i];
      if (!source || typeof source !== "object") continue;

      var title = typeof source.title === "string" ? source.title.trim() : "";
      var url = typeof source.url === "string" ? source.url.trim() : "";
      if (title && url) return true;
    }

    return false;
  }

  function isValidVerifiedEvent(event, dateKey) {
    if (!event || typeof event !== "object") return false;
    if (event.status !== "verified") return false;
    if (event.dateKey !== dateKey) return false;
    if (typeof event.year !== "number" || !isFinite(event.year)) return false;

    var title = typeof event.title === "string" ? event.title.trim() : "";
    var summary = typeof event.summary === "string" ? event.summary.trim() : "";
    if (!title || !summary) return false;

    return hasValidSource(event.sources);
  }

  function compareEventsForHome(a, b) {
    var priorityA = typeof a.priority === "number" ? a.priority : 0;
    var priorityB = typeof b.priority === "number" ? b.priority : 0;
    if (priorityA !== priorityB) return priorityB - priorityA;
    return b.year - a.year;
  }

  function getVerifiedEventsForDate(data, date) {
    if (!data || typeof data.eventsByDate !== "object" || data.eventsByDate === null) {
      return [];
    }

    var dateKey = getDateKey(date);
    var list = data.eventsByDate[dateKey];
    if (!Array.isArray(list) || !list.length) return [];

    var verified = [];
    for (var i = 0; i < list.length; i += 1) {
      if (isValidVerifiedEvent(list[i], dateKey)) {
        verified.push(list[i]);
      }
    }

    verified.sort(compareEventsForHome);
    return verified;
  }

  function formatYearLabel(event) {
    var year = typeof event.year === "number" ? String(event.year) : "";
    var title = typeof event.title === "string" ? event.title.trim() : "";

    if (year && title) return year + " — " + title;
    if (title) return title;
    if (year) return year;
    return "";
  }

  function showEmptyState(headEl, dateEl, yearEl, textEl) {
    if (headEl) headEl.hidden = true;
    if (dateEl) dateEl.textContent = "";
    if (yearEl) yearEl.textContent = "";
    if (textEl) textEl.textContent = EMPTY_TEXT;
  }

  function showEvent(headEl, dateEl, yearEl, textEl, date, event) {
    if (headEl) headEl.hidden = false;

    if (dateEl) dateEl.textContent = formatDayMonth(date);
    if (yearEl) yearEl.textContent = formatYearLabel(event);

    if (textEl) {
      textEl.textContent =
        typeof event.summary === "string" && event.summary.trim()
          ? event.summary.trim()
          : EMPTY_TEXT;
    }
  }

  function renderHistory() {
    var headEl = document.getElementById("hist-head");
    var dateEl = document.getElementById("hist-date");
    var yearEl = document.getElementById("hist-year");
    var textEl = document.getElementById("hist-text");

    if (!textEl) return;

    var selectedDate = getHistoryDate();
    var events = getVerifiedEventsForDate(loadHistoryData(), selectedDate);

    if (!events.length) {
      showEmptyState(headEl, dateEl, yearEl, textEl);
      return;
    }

    showEvent(headEl, dateEl, yearEl, textEl, selectedDate, events[0]);
  }

  function init() {
    renderHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

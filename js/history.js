(function () {
  "use strict";

  var DATA_URL = "history-events-ru.json";
  var EMPTY_TEXT = "скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить историческую справку.";
  var MAX_EVENTS = 3;

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

  function formatDateLabel(date, event) {
    var dayMonth = formatDayMonth(date);
    var year = typeof event.year === "number" && isFinite(event.year) ? String(event.year) : "";
    return year ? dayMonth + " · " + year : dayMonth;
  }

  function formatQuestion(date) {
    return "Что произошло\n" + formatDayMonth(date) + "?";
  }

  function loadHistoryData() {
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
      console.warn("Не удалось загрузить исторические события:", error);
      return { status: "error", data: null };
    }
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

  function getFirstSource(sources) {
    if (!Array.isArray(sources)) return null;

    for (var i = 0; i < sources.length; i += 1) {
      var source = sources[i];
      if (!source || typeof source !== "object") continue;

      var title = typeof source.title === "string" ? source.title.trim() : "";
      var url = typeof source.url === "string" ? source.url.trim() : "";
      if (title && url) return source;
    }

    return null;
  }

  function getSourceLabel(source) {
    if (!source) return "";

    var shortTitle =
      typeof source.shortTitle === "string" ? source.shortTitle.trim() : "";
    var title = typeof source.title === "string" ? source.title.trim() : "";
    var label = shortTitle || title;

    return label ? label + " ↗" : "";
  }

  function isValidVerifiedEvent(event, dateKey) {
    if (!event || typeof event !== "object") return false;
    if (event.status !== "verified") return false;

    if (typeof event.dateKey === "string" && event.dateKey.trim()) {
      if (event.dateKey.trim() !== dateKey) return false;
    }

    if (typeof event.year !== "number" || !isFinite(event.year)) return false;

    var title = typeof event.title === "string" ? event.title.trim() : "";
    var summary = typeof event.summary === "string" ? event.summary.trim() : "";
    if (!title || !summary) return false;

    return hasValidSource(event.sources);
  }

  function compareEventsForHome(a, b) {
    var interestA = typeof a.interest === "number" ? a.interest : 0;
    var interestB = typeof b.interest === "number" ? b.interest : 0;
    if (interestA !== interestB) return interestB - interestA;

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
    return verified.slice(0, MAX_EVENTS);
  }

  function setExpanded(card, answerEl, expanded) {
    if (!card) return;

    card.setAttribute("aria-expanded", expanded ? "true" : "false");
    card.classList.toggle("card--history-open", expanded);

    if (answerEl) {
      answerEl.hidden = !expanded;
    }
  }

  function toggleExpanded(card, answerEl) {
    var isOpen = card.getAttribute("aria-expanded") === "true";
    setExpanded(card, answerEl, !isOpen);
  }

  function setImage(imageEl, image, imageAlt) {
    if (!imageEl) return;

    if (image) {
      imageEl.hidden = false;
      imageEl.draggable = false;
      imageEl.src = image;
      imageEl.alt = imageAlt || "";
      return;
    }

    imageEl.removeAttribute("src");
    imageEl.alt = "";
    imageEl.hidden = true;
  }

  function clearExtras(extrasEl) {
    if (!extrasEl) return;
    extrasEl.innerHTML = "";
    extrasEl.hidden = true;
  }

  function showMessage(card, questionEl, imageEl, dateEl, answerEl, moreEl, message) {
    if (questionEl) questionEl.textContent = message;
    if (dateEl) dateEl.textContent = "";

    var textEl = document.getElementById("hist-text");
    if (textEl) textEl.textContent = "";

    var sourceRow = document.getElementById("hist-source-row");
    if (sourceRow) sourceRow.hidden = true;

    if (answerEl) answerEl.hidden = true;

    if (moreEl) {
      moreEl.hidden = true;
      moreEl.textContent = "";
      moreEl.removeAttribute("href");
    }

    clearExtras(document.getElementById("hist-extras"));
    setImage(imageEl, "", "");

    if (card) {
      setExpanded(card, answerEl, false);
      card.classList.remove("card--history-multi");
      card.classList.add("card--history-empty");
      card.setAttribute("aria-disabled", "true");
      card.tabIndex = -1;
    }
  }

  function fillOpenContent(date, events) {
    var main = events[0];
    var dateEl = document.getElementById("hist-date");
    var textEl = document.getElementById("hist-text");
    var moreEl = document.getElementById("hist-more");
    var sourceRow = document.getElementById("hist-source-row");
    var extrasEl = document.getElementById("hist-extras");
    var card = document.getElementById("history-card");

    if (dateEl) dateEl.textContent = formatDateLabel(date, main);

    if (textEl) {
      textEl.textContent =
        typeof main.summary === "string" && main.summary.trim()
          ? main.summary.trim()
          : EMPTY_TEXT;
    }

    var source = getFirstSource(main.sources);
    var label = getSourceLabel(source);
    var url = source && typeof source.url === "string" ? source.url.trim() : "";

    if (moreEl && sourceRow) {
      if (url && label) {
        sourceRow.hidden = false;
        moreEl.hidden = false;
        moreEl.href = url;
        moreEl.textContent = label;
      } else {
        sourceRow.hidden = true;
        moreEl.hidden = true;
        moreEl.textContent = "";
        moreEl.removeAttribute("href");
      }
    }

    if (card) {
      card.classList.toggle("card--history-multi", events.length > 1);
    }

    if (!extrasEl) return;

    clearExtras(extrasEl);

    if (events.length < 2) return;

    for (var i = 1; i < events.length; i += 1) {
      var item = events[i];
      var title = typeof item.title === "string" ? item.title.trim() : "";
      var year =
        typeof item.year === "number" && isFinite(item.year) ? String(item.year) : "";
      if (!title || !year) continue;

      var li = document.createElement("li");
      li.className = "hist__extra";
      li.textContent = year + " · " + title;
      extrasEl.appendChild(li);
    }

    if (extrasEl.childNodes.length) {
      extrasEl.hidden = false;
    }
  }

  function bindInteractions(card, answerEl, moreEl) {
    if (!card || !answerEl) return;

    function isSourceLinkTarget(target) {
      return Boolean(target && target.closest && target.closest("#hist-more"));
    }

    card.addEventListener("click", function (event) {
      if (card.getAttribute("aria-disabled") === "true") return;
      if (isSourceLinkTarget(event.target)) return;
      toggleExpanded(card, answerEl);
    });

    card.addEventListener("keydown", function (event) {
      if (card.getAttribute("aria-disabled") === "true") return;
      if (isSourceLinkTarget(event.target)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleExpanded(card, answerEl);
        return;
      }

      if (event.key === "Escape" && card.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        setExpanded(card, answerEl, false);
      }
    });

    if (moreEl) {
      moreEl.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        var href = moreEl.getAttribute("href");
        if (!href || href === "#") return;

        window.open(href, "_blank", "noopener,noreferrer");
      });
    }
  }

  function renderHistory() {
    var card = document.getElementById("history-card");
    var imageEl = document.getElementById("hist-image");
    var questionEl = document.getElementById("hist-question");
    var dateEl = document.getElementById("hist-date");
    var answerEl = document.getElementById("hist-answer");
    var moreEl = document.getElementById("hist-more");

    if (!card || !questionEl) return;

    var loaded = loadHistoryData();
    if (loaded.status !== "ok" || !loaded.data) {
      showMessage(card, questionEl, imageEl, dateEl, answerEl, moreEl, ERROR_TEXT);
      return;
    }

    var selectedDate = getHistoryDate();
    var events = getVerifiedEventsForDate(loaded.data, selectedDate);

    if (!events.length) {
      showMessage(card, questionEl, imageEl, dateEl, answerEl, moreEl, EMPTY_TEXT);
      return;
    }

    var main = events[0];
    var image = typeof main.image === "string" ? main.image.trim() : "";
    var imageAlt = typeof main.imageAlt === "string" ? main.imageAlt.trim() : "";

    questionEl.textContent = formatQuestion(selectedDate);
    setImage(imageEl, image, imageAlt);
    fillOpenContent(selectedDate, events);
    setExpanded(card, answerEl, false);
    card.classList.remove("card--history-empty");
    card.removeAttribute("aria-disabled");
    card.tabIndex = 0;
    bindInteractions(card, answerEl, moreEl);
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

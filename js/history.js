(function () {
  "use strict";

  var DATA_URL = "history-events-ru.json";
  var EMPTY_TEXT = "скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить историческую справку.";
  var MAX_EVENTS = 3;
  var MODE_IMAGE = "image";
  var MODE_TEXT = "text";
  var MONTH_GENITIVE = [
    "января",
    "февраля",
    "марта",
    "апреля",
    "мая",
    "июня",
    "июля",
    "августа",
    "сентября",
    "октября",
    "ноября",
    "декабря"
  ];

  var state = {
    date: null,
    events: [],
    index: 0,
    mode: MODE_IMAGE,
    bound: false
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

  function getSourceDisplayName(source) {
    if (!source || typeof source !== "object") return "";

    var name = typeof source.name === "string" ? source.name.trim() : "";
    if (name) return name;

    var shortTitle = typeof source.shortTitle === "string" ? source.shortTitle.trim() : "";
    if (shortTitle) return shortTitle;

    var title = typeof source.title === "string" ? source.title.trim() : "";
    return title;
  }

  function formatChromeSourceLabel(sourceName) {
    var name = typeof sourceName === "string" ? sourceName.trim() : "";
    return name ? "↗ " + name : "";
  }

  function formatDayYearLabel(date, year) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    if (typeof year !== "number" || !isFinite(year)) return "";

    var monthName = MONTH_GENITIVE[date.getMonth()];
    if (!monthName) return String(year);

    return date.getDate() + " " + monthName + " · " + year;
  }

  function openSourceUrl(url) {
    if (!url || url === "#") return;
    window.open(url, "_blank", "noopener,noreferrer");
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

  function getEls() {
    return {
      card: document.getElementById("history-card"),
      imageEl: document.getElementById("hist-image"),
      coverRowEl: document.getElementById("hist-cover-row"),
      questionEl: document.getElementById("hist-question"),
      yearEl: document.getElementById("hist-year"),
      answerEl: document.getElementById("hist-answer"),
      titleEl: document.getElementById("hist-title"),
      textEl: document.getElementById("hist-text"),
      factEl: document.getElementById("hist-fact"),
      sourceEl: document.getElementById("hist-source"),
      sourceLinkEl: document.getElementById("hist-source-link"),
      chromeEl: document.getElementById("hist-chrome"),
      chromeCountEl: document.getElementById("hist-chrome-count"),
      moreEl: document.getElementById("hist-more"),
      moreLinkEl: document.getElementById("hist-more-link"),
      navCountEl: document.getElementById("hist-nav-count"),
      prevBtn: document.getElementById("hist-prev"),
      nextBtn: document.getElementById("hist-next")
    };
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

  function flatStepCount() {
    return state.events.length * 2;
  }

  function getFlatIndex() {
    return state.index * 2 + (state.mode === MODE_TEXT ? 1 : 0);
  }

  function setFromFlatIndex(flat) {
    var total = flatStepCount();
    if (total < 1) return;
    flat = ((flat % total) + total) % total;
    state.index = Math.floor(flat / 2);
    state.mode = flat % 2 === 0 ? MODE_IMAGE : MODE_TEXT;
  }

  function goCover() {
    state.index = 0;
    state.mode = MODE_IMAGE;
  }

  function shiftStep(delta) {
    if (!state.events.length) return;
    setFromFlatIndex(getFlatIndex() + delta);
    renderView(getEls());
  }

  function clearEventContent(els) {
    if (els.yearEl) {
      els.yearEl.textContent = "";
      els.yearEl.setAttribute("hidden", "");
    }
    if (els.titleEl) els.titleEl.textContent = "";
    if (els.textEl) els.textEl.textContent = "";

    if (els.factEl) {
      els.factEl.textContent = "";
      els.factEl.setAttribute("hidden", "");
    }

    if (els.sourceEl) els.sourceEl.setAttribute("hidden", "");
    if (els.sourceLinkEl) {
      els.sourceLinkEl.textContent = "";
      els.sourceLinkEl.removeAttribute("href");
    }

    if (els.moreEl) {
      els.moreEl.setAttribute("hidden", "");
    }
    if (els.moreLinkEl) {
      els.moreLinkEl.textContent = "";
      els.moreLinkEl.removeAttribute("href");
    }

    if (els.navCountEl) {
      els.navCountEl.setAttribute("hidden", "");
      els.navCountEl.textContent = "";
    }

    if (els.chromeCountEl) {
      els.chromeCountEl.setAttribute("hidden", "");
      els.chromeCountEl.textContent = "";
    }
  }

  function showMessage(els, message) {
    if (els.questionEl) els.questionEl.textContent = message;
    if (els.coverRowEl) els.coverRowEl.removeAttribute("hidden");
    if (els.answerEl) els.answerEl.hidden = true;

    clearEventContent(els);
    setImage(els.imageEl, "", "");

    if (els.card) {
      els.card.classList.remove(
        "card--history-image",
        "card--history-text",
        "card--history-cover",
        "card--history-multi"
      );
      els.card.classList.add("card--history-empty");
      els.card.setAttribute("aria-disabled", "true");
      els.card.tabIndex = -1;
    }

    state.events = [];
    state.index = 0;
    state.mode = MODE_IMAGE;
  }

  function fillEventFields(els, event) {
    if (els.titleEl) {
      els.titleEl.textContent =
        typeof event.title === "string" && event.title.trim()
          ? event.title.trim()
          : "";
    }

    if (els.yearEl) {
      var yearLabel =
        typeof event.year === "number" && isFinite(event.year)
          ? formatDayYearLabel(state.date, event.year)
          : "";
      els.yearEl.textContent = yearLabel;
      if (yearLabel) els.yearEl.removeAttribute("hidden");
      else els.yearEl.setAttribute("hidden", "");
    }

    if (els.textEl) {
      els.textEl.textContent =
        typeof event.summary === "string" && event.summary.trim()
          ? event.summary.trim()
          : EMPTY_TEXT;
    }

    var fact = typeof event.fact === "string" ? event.fact.trim() : "";
    if (els.factEl) {
      if (fact) {
        els.factEl.removeAttribute("hidden");
        els.factEl.textContent = fact;
      } else {
        els.factEl.setAttribute("hidden", "");
        els.factEl.textContent = "";
      }
    }

    var source = getFirstSource(event.sources);
    var url = source && typeof source.url === "string" ? source.url.trim() : "";
    var sourceName = getSourceDisplayName(source);

    if (els.sourceEl) els.sourceEl.setAttribute("hidden", "");
    if (els.sourceLinkEl) {
      els.sourceLinkEl.textContent = "";
      els.sourceLinkEl.removeAttribute("href");
    }

    if (els.moreEl && els.moreLinkEl) {
      if (url && sourceName) {
        els.moreEl.removeAttribute("hidden");
        els.moreLinkEl.href = url;
        els.moreLinkEl.textContent = formatChromeSourceLabel(sourceName);
      } else {
        els.moreEl.setAttribute("hidden", "");
        els.moreLinkEl.textContent = "";
        els.moreLinkEl.removeAttribute("href");
      }
    }
  }

  function updateCounter(els, total) {
    var label = state.index + 1 + " / " + total;
    var multi = total > 1;

    if (els.navCountEl) {
      if (multi && state.mode === MODE_TEXT) {
        els.navCountEl.removeAttribute("hidden");
        els.navCountEl.textContent = label;
      } else {
        els.navCountEl.setAttribute("hidden", "");
        els.navCountEl.textContent = "";
      }
    }

    if (els.chromeCountEl) {
      if (multi && state.mode === MODE_IMAGE) {
        els.chromeCountEl.removeAttribute("hidden");
        els.chromeCountEl.textContent = label;
      } else {
        els.chromeCountEl.setAttribute("hidden", "");
        els.chromeCountEl.textContent = "";
      }
    }
  }

  function renderView(els) {
    if (!els.card || !state.events.length || !state.date) return;

    var event = state.events[state.index];
    if (!event) return;

    var total = state.events.length;
    var imageMode = state.mode === MODE_IMAGE;
    var title =
      typeof event.title === "string" && event.title.trim()
        ? event.title.trim()
        : "";

    var image = typeof event.image === "string" ? event.image.trim() : "";
    var imageAlt = typeof event.imageAlt === "string" ? event.imageAlt.trim() : "";
    setImage(els.imageEl, image, imageAlt);

    fillEventFields(els, event);
    updateCounter(els, total);

    if (els.questionEl) {
      els.questionEl.textContent = imageMode ? title : "";
    }

    if (els.coverRowEl) {
      if (imageMode && title) els.coverRowEl.removeAttribute("hidden");
      else els.coverRowEl.setAttribute("hidden", "");
    }

    if (els.answerEl) {
      els.answerEl.hidden = imageMode;
    }

    els.card.classList.remove("card--history-empty", "card--history-cover");
    els.card.classList.toggle("card--history-image", imageMode);
    els.card.classList.toggle("card--history-text", !imageMode);
    els.card.classList.toggle("card--history-multi", total > 1);
    els.card.removeAttribute("aria-disabled");
    els.card.tabIndex = 0;
  }

  function eventElement(target) {
    if (!target) return null;
    if (target.nodeType === 3) return target.parentElement;
    return target;
  }

  function isInteractiveTarget(target) {
    var el = eventElement(target);
    if (!el || !el.closest) return false;
    return Boolean(el.closest("#hist-chrome, #hist-source, #hist-source-link"));
  }

  function bindInteractions(els) {
    if (!els.card || state.bound) return;
    state.bound = true;

    els.card.addEventListener("click", function (event) {
      if (els.card.getAttribute("aria-disabled") === "true") return;
      if (isInteractiveTarget(event.target)) return;
      shiftStep(1);
    });

    els.card.addEventListener("keydown", function (event) {
      if (els.card.getAttribute("aria-disabled") === "true") return;
      if (isInteractiveTarget(event.target)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        shiftStep(1);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftStep(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftStep(-1);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        goCover();
        renderView(els);
      }
    });

    if (els.chromeEl) {
      els.chromeEl.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    if (els.sourceLinkEl) {
      els.sourceLinkEl.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openSourceUrl(els.sourceLinkEl.getAttribute("href"));
      });
    }

    if (els.moreLinkEl) {
      els.moreLinkEl.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        openSourceUrl(els.moreLinkEl.getAttribute("href"));
      });
    }

    if (els.prevBtn) {
      els.prevBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        shiftStep(-1);
      });
    }

    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        shiftStep(1);
      });
    }
  }

  function renderHistory() {
    var els = getEls();
    if (!els.card || !els.questionEl) return;

    var loaded = loadHistoryData();
    if (loaded.status !== "ok" || !loaded.data) {
      showMessage(els, ERROR_TEXT);
      return;
    }

    var selectedDate = getHistoryDate();
    var events = getVerifiedEventsForDate(loaded.data, selectedDate);

    if (!events.length) {
      showMessage(els, EMPTY_TEXT);
      return;
    }

    state.date = selectedDate;
    state.events = events;
    goCover();
    renderView(els);
    bindInteractions(els);
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

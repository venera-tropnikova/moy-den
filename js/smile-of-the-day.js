(function () {
  "use strict";

  var DATA_URL = "smile-of-the-day.json";
  var EMPTY_TEXT = "Улыбка дня скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить улыбку дня.";

  function loadSmileData() {
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
      console.warn("Не удалось загрузить улыбку дня:", error);
      return { status: "error", data: null };
    }
  }

  function normalizeItems(rawItems) {
    var out = [];
    if (!Array.isArray(rawItems)) return out;

    for (var i = 0; i < rawItems.length; i += 1) {
      var item = rawItems[i];
      if (!item || typeof item !== "object") continue;

      var image = typeof item.image === "string" ? item.image.trim() : "";
      var caption = typeof item.caption === "string" ? item.caption.trim() : "";
      if (!image && !caption) continue;

      out.push({
        image: image,
        imageAlt: typeof item.imageAlt === "string" ? item.imageAlt.trim() : "",
        caption: caption
      });
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

  function getDayIndex(date) {
    var y = date.getFullYear();
    var m = date.getMonth();
    var d = date.getDate();
    return Math.floor(Date.UTC(y, m, d) / 86400000);
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

  function getEls() {
    return {
      card: document.getElementById("smile-card"),
      image: document.getElementById("smile-image"),
      caption: document.getElementById("smile-caption")
    };
  }

  function showMessage(els, message) {
    if (els.caption) els.caption.textContent = message;
    if (els.image) {
      els.image.removeAttribute("src");
      els.image.alt = "";
      els.image.hidden = true;
    }
    if (els.card) els.card.setAttribute("aria-disabled", "true");
  }

  function renderItem(els, item) {
    if (!item) {
      showMessage(els, EMPTY_TEXT);
      return;
    }

    if (els.image) {
      if (item.image) {
        els.image.hidden = false;
        els.image.src = item.image;
        els.image.alt = item.imageAlt || "";
      } else {
        els.image.hidden = true;
        els.image.removeAttribute("src");
        els.image.alt = "";
      }
    }

    if (els.caption) {
      els.caption.textContent = item.caption || EMPTY_TEXT;
    }

    if (els.card) els.card.removeAttribute("aria-disabled");
  }

  function renderSmile() {
    var els = getEls();
    if (!els.card || !els.caption) return;

    var loaded = loadSmileData();
    if (loaded.status !== "ok" || !loaded.data) {
      showMessage(els, ERROR_TEXT);
      return;
    }

    var items = normalizeItems(loaded.data.items);
    if (!items.length) {
      showMessage(els, EMPTY_TEXT);
      return;
    }

    var date = getSelectedDate();
    var index = Math.abs(getDayIndex(date)) % items.length;
    renderItem(els, items[index]);
  }

  function init() {
    renderSmile();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

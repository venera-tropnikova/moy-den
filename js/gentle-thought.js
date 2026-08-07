(function () {
  "use strict";

  var DATA_URL = "assets/data/wisdom.json";
  var EMPTY_TEXT = "Тихая мысль скоро появится.";
  var ERROR_TEXT = "Сегодня можно не спешить.";

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

  function normalizeItems(rawItems) {
    var out = [];
    if (!Array.isArray(rawItems)) return out;

    for (var i = 0; i < rawItems.length; i += 1) {
      var item = rawItems[i];
      if (typeof item !== "string") continue;
      var text = item.trim();
      if (!text) continue;
      out.push(text);
    }

    return out;
  }

  function getDayIndex(date) {
    var y = date.getFullYear();
    var m = date.getMonth();
    var d = date.getDate();
    return Math.floor(Date.UTC(y, m, d) / 86400000);
  }

  function pickItemForDate(items, date) {
    if (!items.length) return null;
    var dayIndex = getDayIndex(date);
    var index = Math.abs(dayIndex) % items.length;
    return items[index];
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

    var thought = pickItemForDate(items, new Date());
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

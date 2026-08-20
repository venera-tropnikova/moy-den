(function () {
  "use strict";

  var DATA_URL = "smile-of-the-day.json";
  var EMPTY_TEXT = "Улыбка дня скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить улыбку дня.";

  var items = [];
  var index = 0;

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
        id: typeof item.id === "string" ? item.id.trim() : "smile-" + (out.length + 1),
        image: image,
        imageAlt: typeof item.imageAlt === "string" ? item.imageAlt.trim() : "",
        caption: caption
      });
    }

    return out;
  }

  function getEls() {
    return {
      card: document.getElementById("smile-card"),
      image: document.getElementById("smile-image"),
      caption: document.getElementById("smile-caption"),
      count: document.getElementById("smile-count"),
      prevBtn: document.getElementById("smile-prev"),
      nextBtn: document.getElementById("smile-next")
    };
  }

  function showMessage(els, message) {
    if (els.caption) els.caption.textContent = message;
    if (els.image) {
      els.image.removeAttribute("src");
      els.image.alt = "";
      els.image.hidden = true;
    }
    if (els.count) {
      els.count.hidden = true;
      els.count.textContent = "";
    }
    if (els.prevBtn) els.prevBtn.disabled = true;
    if (els.nextBtn) els.nextBtn.disabled = true;
    if (els.card) els.card.setAttribute("aria-disabled", "true");
  }

  function renderSlide(els) {
    if (!items.length) {
      showMessage(els, EMPTY_TEXT);
      return;
    }

    if (index < 0) index = items.length - 1;
    if (index >= items.length) index = 0;

    var item = items[index];
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

    if (els.count) {
      els.count.hidden = false;
      els.count.textContent = index + 1 + "/" + items.length;
    }

    if (els.prevBtn) els.prevBtn.disabled = items.length < 2;
    if (els.nextBtn) els.nextBtn.disabled = items.length < 2;
    if (els.card) els.card.removeAttribute("aria-disabled");
  }

  function go(delta, els) {
    if (items.length < 2) return;
    index = (index + delta + items.length) % items.length;
    renderSlide(els);
  }

  function bindInteractions(els) {
    if (els.prevBtn) {
      els.prevBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        go(-1, els);
      });
    }

    if (els.nextBtn) {
      els.nextBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        go(1, els);
      });
    }

    if (els.card) {
      els.card.addEventListener("keydown", function (event) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          go(-1, els);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          go(1, els);
        }
      });
    }
  }

  function renderSmile() {
    var els = getEls();
    if (!els.card || !els.caption) return;

    var loaded = loadSmileData();
    if (loaded.status !== "ok" || !loaded.data) {
      showMessage(els, ERROR_TEXT);
      return;
    }

    items = normalizeItems(loaded.data.items);
    index = 0;

    if (!items.length) {
      showMessage(els, EMPTY_TEXT);
      return;
    }

    renderSlide(els);
    bindInteractions(els);
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

(function () {
  "use strict";

  var DATA_URL = "discovery-of-the-day.json";
  var EMPTY_TEXT = "Открытие дня скоро появится.";
  var ERROR_TEXT = "Не удалось загрузить открытие дня.";

  function loadDiscoveryData() {
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
      console.warn("Не удалось загрузить открытие дня:", error);
      return { status: "error", data: null };
    }
  }

  function setExpanded(card, answerEl, expanded) {
    if (!card) return;

    card.setAttribute("aria-expanded", expanded ? "true" : "false");
    card.classList.toggle("card--discovery-open", expanded);

    if (answerEl) {
      answerEl.hidden = !expanded;
    }
  }

  function toggleExpanded(card, answerEl) {
    var isOpen = card.getAttribute("aria-expanded") === "true";
    setExpanded(card, answerEl, !isOpen);
  }

  function fillAnswer(answerEl, answer) {
    if (!answerEl || !answer) return false;

    var titleEl = document.getElementById("discovery-title");
    var placeEl = document.getElementById("discovery-place");
    var traitsEl = document.getElementById("discovery-traits");
    var factEl = document.getElementById("discovery-fact");

    var title = typeof answer.title === "string" ? answer.title.trim() : "";
    var place = typeof answer.place === "string" ? answer.place.trim() : "";
    var fact = typeof answer.fact === "string" ? answer.fact.trim() : "";
    var traits = Array.isArray(answer.traits) ? answer.traits : [];

    if (titleEl) titleEl.textContent = title;
    if (placeEl) placeEl.textContent = place;
    if (factEl) factEl.textContent = fact;

    if (traitsEl) {
      traitsEl.textContent = "";
      for (var i = 0; i < traits.length; i += 1) {
        var text = typeof traits[i] === "string" ? traits[i].trim() : "";
        if (!text) continue;
        var li = document.createElement("li");
        li.textContent = text;
        traitsEl.appendChild(li);
      }
    }

    return Boolean(title || place || fact || traitsEl && traitsEl.children.length);
  }

  function showMessage(questionEl, imageEl, answerEl, card, message) {
    if (questionEl) questionEl.textContent = message;
    if (imageEl) {
      imageEl.removeAttribute("src");
      imageEl.alt = "";
      imageEl.hidden = true;
    }
    if (answerEl) answerEl.hidden = true;
    if (card) {
      card.setAttribute("aria-expanded", "false");
      card.classList.remove("card--discovery-open");
      card.setAttribute("aria-disabled", "true");
      card.tabIndex = -1;
    }
  }

  function bindInteractions(card, answerEl) {
    if (!card || !answerEl) return;

    card.addEventListener("click", function () {
      if (card.getAttribute("aria-disabled") === "true") return;
      toggleExpanded(card, answerEl);
    });

    card.addEventListener("keydown", function (event) {
      if (card.getAttribute("aria-disabled") === "true") return;

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
  }

  function renderDiscovery() {
    var card = document.getElementById("discovery-card");
    var imageEl = document.getElementById("discovery-image");
    var questionEl = document.getElementById("discovery-question");
    var answerEl = document.getElementById("discovery-answer");

    if (!card || !questionEl) return;

    var loaded = loadDiscoveryData();
    if (loaded.status !== "ok" || !loaded.data) {
      showMessage(questionEl, imageEl, answerEl, card, ERROR_TEXT);
      return;
    }

    var data = loaded.data;
    var question = typeof data.question === "string" ? data.question.trim() : "";
    var image = typeof data.image === "string" ? data.image.trim() : "";
    var imageAlt = typeof data.imageAlt === "string" ? data.imageAlt.trim() : "";
    var hasAnswer = fillAnswer(answerEl, data.answer);

    if (!question && !image && !hasAnswer) {
      showMessage(questionEl, imageEl, answerEl, card, EMPTY_TEXT);
      return;
    }

    questionEl.textContent = question || EMPTY_TEXT;

    if (imageEl) {
      if (image) {
        imageEl.hidden = false;
        imageEl.src = image;
        imageEl.alt = imageAlt || "";
      } else {
        imageEl.hidden = true;
      }
    }

    setExpanded(card, answerEl, false);
    card.removeAttribute("aria-disabled");
    card.tabIndex = 0;
    bindInteractions(card, answerEl);
  }

  function init() {
    renderDiscovery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

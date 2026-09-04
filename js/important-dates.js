(function () {
  "use strict";

  var editingId = null;
  var invalidateDateVoiceInput = function () {};

  var MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var CATEGORY_LABELS = {
    "семья": "Семья",
    "работа": "Работа",
    "личное": "Личное",
    "учёба": "Учёба",
    "путешествия": "Путешествия",
    "другое": "Другое"
  };

  var REMINDER_LABELS = {
    "": "Без напоминания",
    "in-day": "В этот день",
    "day-before": "За день",
    "week-before": "За неделю"
  };

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function getStorage() {
    return window.MyDayImportantDatesStorage;
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function daysInMonth(month, year) {
    var safeYear = year && year >= 1000 ? year : 2024;
    return new Date(safeYear, month, 0).getDate();
  }

  function buildYearlyDate(day, month) {
    return "0000-" + padDatePart(month) + "-" + padDatePart(day);
  }

  function parseStoredDate(dateValue) {
    if (typeof dateValue !== "string") return null;
    var match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function formatEventDate(item) {
    var parts = parseStoredDate(item.date);
    if (!parts) return "—";

    var dateText = parts.day + " " + MONTHS_GENITIVE[parts.month - 1];
    if (!item.yearly && parts.year >= 1000) {
      dateText += " " + parts.year;
    }

    return dateText;
  }

  function formatMetaLine(item) {
    var parts = [
      item.yearly ? "Ежегодно" : "Один раз",
      formatEventDate(item),
      CATEGORY_LABELS[item.category] || "Другое"
    ];

    if (item.reminder) {
      parts.push(REMINDER_LABELS[item.reminder] || item.reminder);
    }

    return parts.join(" · ");
  }

  function getFormElements() {
    return {
      form: document.getElementById("date-form"),
      formSection: document.getElementById("date-form-section"),
      formTitle: document.getElementById("date-form-title"),
      listSection: document.getElementById("dates-list-section"),
      status: document.getElementById("date-status"),
      title: document.getElementById("date-title"),
      yearly: document.getElementById("date-yearly"),
      once: document.getElementById("date-once"),
      day: document.getElementById("date-day"),
      month: document.getElementById("date-month"),
      fullDate: document.getElementById("date-full"),
      category: document.getElementById("date-category"),
      reminder: document.getElementById("date-reminder"),
      yearlyFields: document.getElementById("yearly-date-fields"),
      onceField: document.getElementById("once-date-field"),
      submitButton: document.getElementById("date-submit-btn"),
      showButton: document.getElementById("show-date-form"),
      cancelButton: document.getElementById("date-cancel-btn")
    };
  }

  function setFormMode(mode) {
    var els = getFormElements();
    var isEdit = mode === "edit";

    if (els.formTitle) {
      els.formTitle.textContent = isEdit ? "Изменить событие" : "Добавить событие";
    }

    if (els.submitButton) {
      els.submitButton.textContent = isEdit ? "Сохранить изменения" : "Сохранить";
    }
  }

  function updateTypeFields() {
    var els = getFormElements();
    var isYearly = els.yearly && els.yearly.checked;

    if (els.yearlyFields) els.yearlyFields.hidden = !isYearly;
    if (els.onceField) els.onceField.hidden = isYearly;
  }

  function updateAddButtonVisibility() {
    var els = getFormElements();
    if (!els.showButton) return;
    els.showButton.hidden = els.formSection && !els.formSection.hidden;
  }

  function resetFormState() {
    var els = getFormElements();
    invalidateDateVoiceInput();
    editingId = null;
    if (els.form) els.form.reset();
    if (els.status) els.status.textContent = "";
    if (els.yearly) els.yearly.checked = true;
    setFormMode("add");
    updateTypeFields();
  }

  function showListView() {
    var els = getFormElements();
    if (els.formSection) els.formSection.hidden = true;
    if (els.listSection) els.listSection.hidden = false;
    updateAddButtonVisibility();
  }

  function openDateForm() {
    var els = getFormElements();
    if (els.listSection) els.listSection.hidden = true;
    if (els.formSection) els.formSection.hidden = false;
    if (els.showButton) els.showButton.hidden = true;
    updateTypeFields();
    if (els.title) els.title.focus();
  }

  function closeDateForm() {
    resetFormState();
    showListView();
  }

  function openEditForm(item) {
    var els = getFormElements();
    var parts = parseStoredDate(item.date);

    invalidateDateVoiceInput();
    editingId = item.id;
    setFormMode("edit");

    if (els.title) els.title.value = typeof item.title === "string" ? item.title : "";
    if (els.category) els.category.value = item.category || "другое";
    if (els.reminder) els.reminder.value = item.reminder || "";

    if (item.yearly) {
      if (els.yearly) els.yearly.checked = true;
      if (els.day) els.day.value = parts ? String(parts.day) : "";
      if (els.month) els.month.value = parts ? String(parts.month) : "";
      if (els.fullDate) els.fullDate.value = "";
    } else {
      if (els.once) els.once.checked = true;
      if (els.day) els.day.value = "";
      if (els.month) els.month.value = "";
      if (els.fullDate) {
        els.fullDate.value = parts && parts.year >= 1000
          ? parts.year + "-" + padDatePart(parts.month) + "-" + padDatePart(parts.day)
          : "";
      }
    }

    if (els.status) els.status.textContent = "";
    openDateForm();
  }

  function renderImportantDates() {
    var storage = getStorage();
    var list = document.getElementById("dates-list");
    var empty = document.getElementById("dates-empty");
    if (!storage || !list || !empty) return;

    var items = storage.loadImportantDates();
    list.innerHTML = "";
    empty.hidden = items.length > 0;
    updateAddButtonVisibility();

    items.forEach(function (item) {
      var row = document.createElement("li");
      row.className = "dates-item";

      var body = document.createElement("div");

      var title = document.createElement("p");
      title.className = "dates-item__title";
      title.textContent = item.title || "—";

      var meta = document.createElement("p");
      meta.className = "dates-item__meta";
      meta.textContent = formatMetaLine(item);

      var actions = document.createElement("div");
      actions.className = "dates-item__actions";

      var editButton = document.createElement("button");
      editButton.className = "dates-edit-btn";
      editButton.type = "button";
      editButton.textContent = "Изменить";
      editButton.addEventListener("click", function () {
        openEditForm(item);
      });

      var deleteButton = document.createElement("button");
      deleteButton.className = "dates-delete-btn";
      deleteButton.type = "button";
      deleteButton.textContent = "Удалить";
      deleteButton.addEventListener("click", function () {
        storage.deleteImportantDate(item.id);
        if (String(editingId) === String(item.id)) {
          closeDateForm();
        }
        renderImportantDates();
      });

      body.appendChild(title);
      body.appendChild(meta);
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      row.appendChild(body);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function parseQueryDate() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get("date");
    var match = value && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return {
      year: year,
      month: month,
      day: day,
      iso: match[1] + "-" + match[2] + "-" + match[3]
    };
  }

  function applyPrefillDateFromQuery() {
    var parsed = parseQueryDate();
    if (!parsed) return;

    var els = getFormElements();
    if (!els.formSection) return;

    if (els.yearly) els.yearly.checked = true;
    if (els.day) els.day.value = String(parsed.day);
    if (els.month) els.month.value = String(parsed.month);
    if (els.fullDate) els.fullDate.value = parsed.iso;

    updateTypeFields();
    openDateForm();
  }

  function isAppleTouchDevice() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPod|iPad/.test(ua)) return true;
    if (navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function initVoiceInput() {
    var voiceBtn = document.getElementById("date-voice-btn");
    var titleInput = document.getElementById("date-title");
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var activeRecognition = null;
    var activeSession = 0;
    var listening = false;
    var voiceWatchdogTimer = null;
    var micHintHideTimer = null;
    var VOICE_WATCHDOG_MS = 8000;
    var MIC_HINT_HIDE_MS = 4000;
    var HINT_TEXT = "Используйте 🎙 на клавиатуре для диктовки";

    if (!voiceBtn) return;

    function setListening(isListening) {
      listening = isListening;
      if (isListening) {
        voiceBtn.classList.add("mic-btn--listening");
        voiceBtn.setAttribute("aria-pressed", "true");
        voiceBtn.setAttribute("aria-label", "Остановить запись");
      } else {
        voiceBtn.classList.remove("mic-btn--listening");
        voiceBtn.setAttribute("aria-pressed", "false");
        voiceBtn.setAttribute("aria-label", "Голосовой ввод");
      }
    }

    function ensureMicDictationHint(voiceBtn) {
      var parent = voiceBtn && voiceBtn.parentNode;
      var hint;
      var sibling;
      if (!parent || !parent.parentNode) return null;
      sibling = parent.nextSibling;
      while (sibling && sibling.nodeType !== 1) {
        sibling = sibling.nextSibling;
      }
      if (sibling && sibling.classList && sibling.classList.contains("mic-dictation-hint")) {
        return sibling;
      }
      hint = document.createElement("p");
      hint.className = "mic-dictation-hint";
      hint.setAttribute("role", "status");
      hint.setAttribute("aria-live", "polite");
      hint.hidden = true;
      parent.parentNode.insertBefore(hint, parent.nextSibling);
      return hint;
    }

    function clearMicDictationHintTimer() {
      if (micHintHideTimer) {
        window.clearTimeout(micHintHideTimer);
        micHintHideTimer = null;
      }
    }

    function showMicDictationHint(voiceBtn) {
      var hint = ensureMicDictationHint(voiceBtn);
      if (!hint) return;
      hint.textContent = HINT_TEXT;
      hint.hidden = false;
      clearMicDictationHintTimer();
      micHintHideTimer = window.setTimeout(function () {
        hint.hidden = true;
        micHintHideTimer = null;
      }, MIC_HINT_HIDE_MS);
    }

    function clearVoiceWatchdog() {
      if (voiceWatchdogTimer) {
        window.clearTimeout(voiceWatchdogTimer);
        voiceWatchdogTimer = null;
      }
    }

    function armVoiceWatchdog(session) {
      clearVoiceWatchdog();
      voiceWatchdogTimer = window.setTimeout(function () {
        var recognition;
        if (activeSession !== session) return;
        recognition = activeRecognition;
        if (recognition) {
          try {
            recognition.abort();
          } catch (err) {
            // Сессия уже завершилась.
          }
        }
        activeSession += 1;
        activeRecognition = null;
        clearVoiceWatchdog();
        setListening(false);
      }, VOICE_WATCHDOG_MS);
    }

    if (isAppleTouchDevice()) {
      voiceBtn.hidden = false;
      voiceBtn.addEventListener("click", function () {
        if (titleInput) titleInput.focus();
        showMicDictationHint(voiceBtn);
      });
      return;
    }
    if (!SpeechRecognition) return;

    voiceBtn.hidden = false;

    invalidateDateVoiceInput = function () {
      var recognition = activeRecognition;
      activeSession += 1;
      activeRecognition = null;
      clearVoiceWatchdog();
      setListening(false);
      if (recognition) {
        try {
          recognition.abort();
        } catch (err) {
          // Сессия уже завершилась.
        }
      }
    };

    voiceBtn.addEventListener("click", function () {
      if (listening) {
        var recognition = activeRecognition;
        activeSession += 1;
        activeRecognition = null;
        setListening(false);
        clearVoiceWatchdog();
        if (recognition) {
          try { recognition.stop(); } catch (err) {}
          try { recognition.abort(); } catch (err) {}
        }
        return;
      }

      var recognition = new SpeechRecognition();
      var session = activeSession + 1;
      var baseline = titleInput ? titleInput.value : "";

      activeSession = session;
      activeRecognition = recognition;
      recognition.lang = "ru-RU";
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = function (event) {
        if (activeRecognition !== recognition || activeSession !== session) return;

        var transcript = "";
        var i;
        for (i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (titleInput) {
          titleInput.value = (baseline + (baseline && transcript && !/\s$/.test(baseline) ? " " : "") + transcript).slice(0, 120);
        }
      };

      recognition.onend = function () {
        if (activeRecognition !== recognition || activeSession !== session) return;
        activeRecognition = null;
        clearVoiceWatchdog();
        setListening(false);
      };

      recognition.onerror = function () {
        if (activeRecognition !== recognition || activeSession !== session) return;
        activeRecognition = null;
        clearVoiceWatchdog();
        setListening(false);
      };

      try {
        setListening(true);
        recognition.start();
        armVoiceWatchdog(session);
      } catch (err) {
        if (activeRecognition === recognition && activeSession === session) {
          activeRecognition = null;
          clearVoiceWatchdog();
          setListening(false);
        }
      }
    });
  }

  function initForm() {
    var storage = getStorage();
    var els = getFormElements();

    if (!storage || !els.form || !els.title || !els.yearly || !els.once) return;

    if (els.showButton) {
      els.showButton.addEventListener("click", function () {
        resetFormState();
        openDateForm();
      });
    }

    if (els.cancelButton) {
      els.cancelButton.addEventListener("click", closeDateForm);
    }

    if (els.yearly) els.yearly.addEventListener("change", updateTypeFields);
    if (els.once) els.once.addEventListener("change", updateTypeFields);

    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      invalidateDateVoiceInput();

      var title = els.title.value.trim();
      var isYearly = els.yearly.checked;
      var category = els.category ? els.category.value : "другое";
      var reminder = els.reminder ? els.reminder.value : "";
      var dateValue = "";

      if (!title) {
        if (els.status) els.status.textContent = "Укажите название события.";
        return;
      }

      if (isYearly) {
        var day = Number(els.day.value);
        var month = Number(els.month.value);

        if (!day || !month) {
          if (els.status) els.status.textContent = "Укажите день и месяц.";
          return;
        }

        if (day < 1 || day > daysInMonth(month)) {
          if (els.status) els.status.textContent = "Проверьте день и месяц.";
          return;
        }

        dateValue = buildYearlyDate(day, month);
      } else {
        dateValue = els.fullDate ? els.fullDate.value : "";
        if (!dateValue) {
          if (els.status) els.status.textContent = "Укажите дату.";
          return;
        }
      }

      var payload = {
        title: title,
        yearly: isYearly,
        date: dateValue,
        category: category,
        reminder: reminder
      };

      if (editingId !== null) {
        if (!storage.updateImportantDate(editingId, payload)) {
          if (els.status) els.status.textContent = "Не удалось сохранить изменения.";
          return;
        }
      } else {
        storage.addImportantDate(payload);
      }

      closeDateForm();
      renderImportantDates();
    });

    setFormMode("add");
    updateTypeFields();
  }

  function initStatusbarTime() {
    var time = document.getElementById("statusbar-time");
    if (!time) return;

    time.textContent = formatTime(new Date());
    window.setInterval(function () {
      time.textContent = formatTime(new Date());
    }, 60000);
  }

  function init() {
    renderImportantDates();
    initForm();
    initVoiceInput();
    applyPrefillDateFromQuery();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(function () {
  "use strict";

  var editingId = null;

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
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

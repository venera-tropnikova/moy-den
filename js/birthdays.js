(function () {
  "use strict";

  var UNKNOWN_YEAR = 0;
  var editingId = null;

  var returnTo = null;

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function getStorage() {
    return window.MyDayBirthdaysStorage;
  }

  var MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  function getDisplayValue(value) {
    return value ? value : "—";
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function parseBirthDateParts(birthDate) {
    var match = typeof birthDate === "string" && birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);

    if (!month || month < 1 || month > 12 || !day || day < 1 || day > 31) {
      return null;
    }

    return {
      year: year,
      month: month,
      day: day,
      hasYear: year >= 1000
    };
  }

  function buildBirthDate(day, month, year) {
    var safeYear = year ? Number(year) : UNKNOWN_YEAR;
    var yearPart = ("0000" + String(safeYear)).slice(-4);
    return yearPart + "-" + padDatePart(month) + "-" + padDatePart(day);
  }

  function formatBirthdayDate(birthDate) {
    var parts = parseBirthDateParts(birthDate);
    if (!parts) return "—";
    return parts.day + " " + MONTHS_GENITIVE[parts.month - 1];
  }

  function getCurrentAge(birthDate, today) {
    var parts = parseBirthDateParts(birthDate);
    if (!parts || !parts.hasYear) return null;

    var age = today.getFullYear() - parts.year;
    var month = today.getMonth() + 1;
    var day = today.getDate();

    if (month < parts.month || (month === parts.month && day < parts.day)) {
      age -= 1;
    }

    if (age < 0 || age > 150) return null;
    return age;
  }

  function formatAge(age) {
    var mod10 = age % 10;
    var mod100 = age % 100;
    var word = "лет";

    if (mod100 < 11 || mod100 > 14) {
      if (mod10 === 1) word = "год";
      else if (mod10 >= 2 && mod10 <= 4) word = "года";
    }

    return age + " " + word;
  }

  function formatMetaLine(birthday, today) {
    var parts = [];
    var relation = typeof birthday.relation === "string" ? birthday.relation.trim() : "";
    var age = getCurrentAge(birthday.birthDate, today);

    if (relation) parts.push(relation);
    parts.push(formatBirthdayDate(birthday.birthDate));
    if (age !== null) parts.push(formatAge(age));

    return parts.join(" · ");
  }

  function daysInMonth(month, year) {
    var safeYear = year && year >= 1000 ? year : 2024;
    return new Date(safeYear, month, 0).getDate();
  }

  function getFormElements() {
    return {
      form: document.getElementById("birthday-form"),
      formSection: document.getElementById("birthday-form-section"),
      listSection: document.getElementById("birthdays-list-section"),
      formTitle: document.getElementById("birthdays-form-title"),
      status: document.getElementById("birthday-status"),
      name: document.getElementById("birthday-name"),
      relation: document.getElementById("birthday-relation"),
      dayInput: document.getElementById("birthday-day"),
      monthInput: document.getElementById("birthday-month"),
      yearInput: document.getElementById("birthday-year"),
      showButton: document.getElementById("show-birthday-form"),
      cancelButton: document.getElementById("birthday-cancel-btn")
    };
  }

  function updateAddButtonVisibility() {
    var els = getFormElements();
    if (!els.showButton) return;

    var formOpen = els.formSection && !els.formSection.hidden;
    els.showButton.hidden = formOpen;
  }

  function setFormMode(mode) {
    var els = getFormElements();
    if (els.formTitle) {
      els.formTitle.textContent = mode === "edit" ? "Изменить" : "Добавить";
    }
  }

  function resetFormState() {
    var els = getFormElements();
    editingId = null;
    if (els.form) els.form.reset();
    if (els.status) els.status.textContent = "";
    setFormMode("add");
  }

  function showListView() {
    var els = getFormElements();
    if (els.formSection) els.formSection.hidden = true;
    if (els.listSection) els.listSection.hidden = false;
    updateAddButtonVisibility();
  }

  function openBirthdayForm() {
    var els = getFormElements();

    if (els.listSection) els.listSection.hidden = true;
    if (els.formSection) els.formSection.hidden = false;
    if (els.showButton) els.showButton.hidden = true;
    if (els.name) els.name.focus();
  }

  function closeBirthdayForm() {
    resetFormState();
    showListView();
  }

  function leaveToReturn() {
    if (returnTo) {
      window.location.href = returnTo;
      return true;
    }
    return false;
  }

  function initReturnNavigation() {
    var back = document.querySelector(".back-btn");
    if (back && returnTo) {
      back.setAttribute("href", returnTo);
    }
  }

  function openEditForm(birthday) {
    var els = getFormElements();
    var parts = parseBirthDateParts(birthday.birthDate);

    editingId = birthday.id;
    setFormMode("edit");

    if (els.name) els.name.value = typeof birthday.name === "string" ? birthday.name : "";
    if (els.relation) {
      els.relation.value = typeof birthday.relation === "string" ? birthday.relation : "";
    }
    if (els.dayInput) els.dayInput.value = parts ? String(parts.day) : "";
    if (els.monthInput) els.monthInput.value = parts ? String(parts.month) : "";
    if (els.yearInput) {
      els.yearInput.value = parts && parts.hasYear ? String(parts.year) : "";
    }
    if (els.status) els.status.textContent = "";

    openBirthdayForm();
  }

  function saveBirthdayById(id, nextBirthday) {
    var storage = getStorage();
    if (!storage) return false;

    var birthdays = storage.loadBirthdays();
    var index = birthdays.findIndex(function (birthday) {
      return String(birthday.id) === String(id);
    });

    if (index === -1) return false;

    birthdays[index] = {
      id: birthdays[index].id,
      name: nextBirthday.name,
      relation: nextBirthday.relation,
      birthDate: nextBirthday.birthDate
    };

    return storage.saveBirthdays(birthdays);
  }

  function renderBirthdays() {
    var storage = getStorage();
    var list = document.getElementById("birthdays-list");
    var empty = document.getElementById("birthdays-empty");
    if (!storage || !list || !empty) return;

    var birthdays = storage.loadBirthdays();
    var today = new Date();
    list.innerHTML = "";
    empty.hidden = birthdays.length > 0;
    updateAddButtonVisibility();

    birthdays.forEach(function (birthday) {
      var item = document.createElement("li");
      item.className = "birthday-item";

      var body = document.createElement("div");

      var name = document.createElement("p");
      name.className = "birthday-item__name";
      name.textContent = getDisplayValue(birthday.name);

      var meta = document.createElement("p");
      meta.className = "birthday-item__meta";
      meta.textContent = formatMetaLine(birthday, today);

      var actions = document.createElement("div");
      actions.className = "birthday-item__actions";

      var editButton = document.createElement("button");
      editButton.className = "birthday-edit-btn";
      editButton.type = "button";
      editButton.textContent = "Изменить";
      editButton.addEventListener("click", function () {
        openEditForm(birthday);
      });

      var deleteButton = document.createElement("button");
      deleteButton.className = "birthday-delete-btn";
      deleteButton.type = "button";
      deleteButton.textContent = "Удалить";
      deleteButton.addEventListener("click", function () {
        storage.deleteBirthday(birthday.id);
        if (String(editingId) === String(birthday.id)) {
          closeBirthdayForm();
        }
        renderBirthdays();
      });

      body.appendChild(name);
      body.appendChild(meta);
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);
      item.appendChild(body);
      item.appendChild(actions);
      list.appendChild(item);
    });
  }

  function initForm() {
    var storage = getStorage();
    var els = getFormElements();

    if (
      !storage ||
      !els.form ||
      !els.name ||
      !els.relation ||
      !els.dayInput ||
      !els.monthInput ||
      !els.yearInput
    ) {
      return;
    }

    if (els.showButton) {
      els.showButton.addEventListener("click", function () {
        resetFormState();
        openBirthdayForm();
      });
    }

    if (els.cancelButton) {
      els.cancelButton.addEventListener("click", function () {
        if (leaveToReturn()) return;
        closeBirthdayForm();
      });
    }

    els.form.addEventListener("submit", function (event) {
      event.preventDefault();

      var nextName = els.name.value.trim();
      var nextRelation = els.relation.value.trim();
      var day = Number(els.dayInput.value);
      var month = Number(els.monthInput.value);
      var yearValue = els.yearInput.value.trim();
      var year = yearValue ? Number(yearValue) : null;

      if (!nextName || !day || !month) {
        if (els.status) els.status.textContent = "Заполните имя и день рождения.";
        return;
      }

      if (day < 1 || day > daysInMonth(month, year)) {
        if (els.status) els.status.textContent = "Проверьте день и месяц рождения.";
        return;
      }

      if (yearValue && (!year || year < 1900 || year > 2100)) {
        if (els.status) els.status.textContent = "Проверьте год рождения.";
        return;
      }

      var payload = {
        name: nextName,
        relation: nextRelation,
        birthDate: buildBirthDate(day, month, year)
      };

      if (editingId !== null) {
        if (!saveBirthdayById(editingId, payload)) {
          if (els.status) els.status.textContent = "Не удалось сохранить изменения.";
          return;
        }
      } else {
        storage.addBirthday(payload);
      }

      if (leaveToReturn()) return;

      closeBirthdayForm();
      renderBirthdays();
    });
  }

  function initStatusbarTime() {
    var time = document.getElementById("statusbar-time");
    if (!time) return;

    time.textContent = formatTime(new Date());

    window.setInterval(function () {
      time.textContent = formatTime(new Date());
    }, 60000);
  }

  function openEditFromQuery() {
    var storage = getStorage();
    var params = new URLSearchParams(window.location.search);
    returnTo = params.get("return");

    initReturnNavigation();

    if (!storage) return;

    var editId = params.get("edit");
    if (!editId) return;

    var birthday = storage.loadBirthdays().find(function (item) {
      return String(item.id) === String(editId);
    });

    if (!birthday) return;

    openEditForm(birthday);
  }

  function init() {
    renderBirthdays();
    initForm();
    initStatusbarTime();
    openEditFromQuery();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

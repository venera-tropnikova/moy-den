(function () {
  "use strict";

  var WEEKDAYS = [
    "Воскресенье", "Понедельник", "Вторник", "Среда",
    "Четверг", "Пятница", "Суббота"
  ];

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var IMPORTANT_DATES_KEY = "my-day-important-dates-v1";

  var CATEGORY_LABELS = {
    "семья": "Семья",
    "работа": "Работа",
    "личное": "Личное",
    "учёба": "Учёба",
    "путешествия": "Путешествия",
    "другое": "Другое"
  };

  var selectedDate = parseSelectedDate();
  var selectedDateKey = "";
  var tasksStorage = null;

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function parseSelectedDate() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get("date");
    var match = value && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return new Date();

    var year = Number(match[1]);
    var month = Number(match[2]) - 1;
    var day = Number(match[3]);
    var date = new Date(year, month, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return new Date();
    }

    return date;
  }

  function getTasksForSelectedDate() {
    return tasksStorage.getTasksForDate(selectedDateKey);
  }

  function updateTaskText(taskId, text) {
    return tasksStorage.updateTaskForDate(selectedDateKey, taskId, { text: text });
  }

  function renderSelectedDate() {
    var title = document.getElementById("day-title");
    var weekday = document.getElementById("day-weekday");

    if (title) {
      title.textContent = selectedDate.getDate() + " " + MONTHS[selectedDate.getMonth()];
    }

    if (weekday) {
      weekday.textContent = WEEKDAYS[selectedDate.getDay()];
    }
  }

  function loadBirthdays() {
    try {
      var saved = localStorage.getItem(BIRTHDAYS_KEY);
      if (!saved) return [];

      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Не удалось загрузить поздравления:", error);
      return [];
    }
  }

  function loadImportantDates() {
    try {
      var saved = localStorage.getItem(IMPORTANT_DATES_KEY);
      if (!saved) return [];

      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("Не удалось загрузить важные даты:", error);
      return [];
    }
  }

  function loadUserSettings() {
    try {
      var saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (!saved) return {};

      var parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить профиль:", error);
      return {};
    }
  }

  function parseBirthDateParts(birthDate) {
    if (typeof birthDate !== "string") return null;

    var match = birthDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function isBirthdayOnSelectedDate(birthDate) {
    var parts = parseBirthDateParts(birthDate);
    if (!parts) return false;

    return (
      parts.month === selectedDate.getMonth() + 1 &&
      parts.day === selectedDate.getDate()
    );
  }

  function getSelectedDateKey() {
    var year = selectedDate.getFullYear();
    var month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    var day = String(selectedDate.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function isImportantDateOnSelectedDate(item) {
    if (!item || typeof item.date !== "string") return false;

    var parts = parseBirthDateParts(item.date);
    if (!parts) return false;

    if (item.yearly) {
      return (
        parts.month === selectedDate.getMonth() + 1 &&
        parts.day === selectedDate.getDate()
      );
    }

    return item.date.trim() === getSelectedDateKey();
  }

  function formatCategoryLabel(category) {
    if (typeof category !== "string") return "";
    var value = category.trim();
    if (!value) return "";
    return CATEGORY_LABELS[value] || value;
  }

  function getTurningAge(birthDate, onDate) {
    var parts = parseBirthDateParts(birthDate);
    if (!parts || parts.year < 1000) return null;

    var age = onDate.getFullYear() - parts.year;
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

  function getDateValue(date) {
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  }

  function formatTurningAgeLine(age) {
    if (age === null) return null;

    var selectedValue = getDateValue(selectedDate);
    var todayValue = getDateValue(new Date());
    var verb = "Исполняется";

    if (selectedValue < todayValue) verb = "Исполнилось";
    else if (selectedValue > todayValue) verb = "Исполнится";

    return verb + " " + formatAge(age);
  }

  function appendMetaLine(item, text) {
    var line = document.createElement("span");
    line.className = "day-task__text";
    line.style.cursor = "default";
    line.style.marginTop = "2px";
    line.style.fontSize = "0.8rem";
    line.style.color = "var(--ink-mid)";
    line.textContent = text;
    item.appendChild(line);
  }

  function appendCongratulationsItem(list, options) {
    var item = document.createElement("li");
    item.className = "day-task";

    var name = document.createElement("span");
    name.className = "day-task__text";
    name.style.cursor = "default";
    name.textContent = "🎂 " + options.name;

    item.appendChild(name);

    if (options.relation) {
      appendMetaLine(item, options.relation);
    }

    appendMetaLine(item, "День рождения");

    if (options.turningAgeLine) {
      appendMetaLine(item, options.turningAgeLine);
    }

    list.appendChild(item);
  }

  function renderEvents() {
    var empty = document.getElementById("events-empty");
    var list = document.getElementById("events-list");
    if (!empty || !list) return;

    var matches = loadImportantDates().filter(function (item) {
      return isImportantDateOnSelectedDate(item);
    });

    list.innerHTML = "";
    empty.hidden = matches.length > 0;

    matches.forEach(function (item) {
      var titleText = typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "—";
      var categoryLabel = formatCategoryLabel(item.category);

      var row = document.createElement("li");
      row.className = "day-task";

      var title = document.createElement("span");
      title.className = "day-task__text";
      title.style.cursor = "default";
      title.textContent = titleText;
      row.appendChild(title);

      if (categoryLabel) {
        appendMetaLine(row, categoryLabel);
      }

      list.appendChild(row);
    });
  }

  function renderPersonalBirthday() {
    var section = document.getElementById("personal-birthday-section");
    var list = document.getElementById("personal-birthday-list");
    if (!section || !list) return;

    var settings = loadUserSettings();
    var birthDate = typeof settings.birthDate === "string" ? settings.birthDate : "";
    var personalMatch = isBirthdayOnSelectedDate(birthDate);

    list.innerHTML = "";

    if (!personalMatch) {
      section.hidden = true;
      section.setAttribute("hidden", "");
      return;
    }

    section.hidden = false;
    section.removeAttribute("hidden");

    var userName = typeof settings.name === "string" && settings.name.trim()
      ? settings.name.trim()
      : "Венера";
    var turningAgeLine = formatTurningAgeLine(getTurningAge(birthDate, selectedDate));

    var item = document.createElement("li");
    item.className = "day-task";

    var name = document.createElement("span");
    name.className = "day-task__text";
    name.style.cursor = "default";
    name.textContent = "🎂 " + userName;
    item.appendChild(name);

    if (turningAgeLine) {
      appendMetaLine(item, turningAgeLine);
    }

    list.appendChild(item);
  }

  function renderCongratulations() {
    var empty = document.getElementById("birthdays-empty");
    var list = document.getElementById("birthdays-list");
    if (!empty || !list) return;

    var matches = loadBirthdays().filter(function (birthday) {
      return birthday && isBirthdayOnSelectedDate(birthday.birthDate);
    });

    list.innerHTML = "";
    empty.hidden = matches.length > 0;

    matches.forEach(function (birthday) {
      var personName = typeof birthday.name === "string" && birthday.name.trim()
        ? birthday.name.trim()
        : "—";
      var relation = typeof birthday.relation === "string" ? birthday.relation.trim() : "";

      appendCongratulationsItem(list, {
        name: personName,
        relation: relation,
        turningAgeLine: formatTurningAgeLine(getTurningAge(birthday.birthDate, selectedDate))
      });
    });
  }

  function renderTasks() {
    var empty = document.getElementById("tasks-empty");
    var list = document.getElementById("day-tasks-list");
    if (!empty || !list) return;

    var tasks = getTasksForSelectedDate();
    list.innerHTML = "";
    empty.hidden = tasks.length > 0;

    tasks.forEach(function (task) {
      var item = document.createElement("li");
      item.className = "day-task" + (task.done ? " day-task--done" : "");

      var text = document.createElement("span");
      text.className = "day-task__text";
      text.textContent = task.text;
      text.addEventListener("click", function () {
        startTaskEdit(item, task);
      });

      item.appendChild(text);
      list.appendChild(item);
    });
  }

  function startTaskEdit(item, task) {
    var input = document.createElement("input");
    input.className = "day-task-edit";
    input.type = "text";
    input.value = task.text;
    input.maxLength = 200;

    item.innerHTML = "";
    item.appendChild(input);
    input.focus();
    input.select();

    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        renderTasks();
        return;
      }

      if (event.key !== "Enter") return;

      var nextText = input.value.trim();
      if (!nextText) {
        input.focus();
        return;
      }

      if (updateTaskText(task.id, nextText)) {
        renderTasks();
      }
    });
  }

  function hideTaskForm() {
    var form = document.getElementById("day-task-form");
    var input = document.getElementById("day-task-input");
    if (!form || !input) return;

    form.hidden = true;
    input.value = "";
  }

  function initTaskForm() {
    var showButton = document.getElementById("show-task-form");
    var cancelButton = document.getElementById("cancel-task-form");
    var form = document.getElementById("day-task-form");
    var input = document.getElementById("day-task-input");

    if (!showButton || !cancelButton || !form || !input) return;

    showButton.addEventListener("click", function () {
      form.hidden = false;
      input.focus();
    });

    cancelButton.addEventListener("click", hideTaskForm);

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }

      tasksStorage.addTaskForDate(selectedDateKey, text);
      hideTaskForm();
      renderTasks();
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

  function loadTasksStorage(callback) {
    if (window.MyDayTasksStorage) {
      tasksStorage = window.MyDayTasksStorage;
      selectedDateKey = tasksStorage.getDateKey(selectedDate);
      callback();
      return;
    }

    var script = document.querySelector("script[data-my-day-tasks-storage]");
    if (!script) {
      script = document.createElement("script");
      script.src = "js/tasks-storage.js";
      script.dataset.myDayTasksStorage = "true";
    }

    script.addEventListener("load", function () {
      tasksStorage = window.MyDayTasksStorage;
      selectedDateKey = tasksStorage.getDateKey(selectedDate);
      callback();
    });

    if (!script.parentNode) {
      document.head.appendChild(script);
    }
  }

  function initDayContent() {
    renderSelectedDate();
    renderEvents();
    renderPersonalBirthday();
    renderCongratulations();
    initStatusbarTime();
  }

  function initTasksUI() {
    renderTasks();
    initTaskForm();
  }

  function initWhenStorageReady() {
    initDayContent();
    loadTasksStorage(initTasksUI);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWhenStorageReady);
  } else {
    initWhenStorageReady();
  }
})();

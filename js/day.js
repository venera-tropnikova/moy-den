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

  var STORAGE_KEY = "my-day-date-tasks-v1";
  var selectedDate = parseSelectedDate();

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

  function getDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function loadTasksByDate() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};

      var parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить задачи дня:", error);
      return {};
    }
  }

  function saveTasksByDate(tasksByDate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
    } catch (error) {
      console.warn("Не удалось сохранить задачи дня:", error);
    }
  }

  function getTasksForSelectedDate() {
    var tasksByDate = loadTasksByDate();
    var tasks = tasksByDate[getDateKey(selectedDate)];
    return Array.isArray(tasks) ? tasks : [];
  }

  function saveTasksForSelectedDate(tasks) {
    var tasksByDate = loadTasksByDate();
    tasksByDate[getDateKey(selectedDate)] = tasks;
    saveTasksByDate(tasksByDate);
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

  function renderTasks() {
    var empty = document.getElementById("tasks-empty");
    var list = document.getElementById("day-tasks-list");
    if (!empty || !list) return;

    var tasks = getTasksForSelectedDate();
    list.innerHTML = "";
    empty.hidden = tasks.length > 0;

    tasks.forEach(function (task) {
      var item = document.createElement("li");
      item.className = "day-task";
      item.textContent = task.text;
      list.appendChild(item);
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

      var tasks = getTasksForSelectedDate();
      tasks.push({
        id: Date.now(),
        text: text
      });

      saveTasksForSelectedDate(tasks);
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

  function init() {
    renderSelectedDate();
    renderTasks();
    initTaskForm();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

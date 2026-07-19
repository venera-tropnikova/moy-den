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

  function init() {
    renderSelectedDate();
    renderTasks();
    initTaskForm();
    initStatusbarTime();
  }

  function initWhenStorageReady() {
    loadTasksStorage(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWhenStorageReady);
  } else {
    initWhenStorageReady();
  }
})();

(function () {
  "use strict";

  var tasksStorage = null;
  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var IMPORTANT_DATES_KEY = "my-day-important-dates-v1";

  var WEEKDAYS = [
    "Воскресенье", "Понедельник", "Вторник", "Среда",
    "Четверг", "Пятница", "Суббота"
  ];

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var IMPORTANT_DATE_CATEGORY_LABELS = {
    "семья": "Семья",
    "работа": "Работа",
    "личное": "Личное",
    "учёба": "Учёба",
    "путешествия": "Путешествия",
    "другое": "Другое"
  };

  var CALENDAR_EMPTY_TEXT = "Сегодня важных дат нет.";

  var JOKE =
    "— Почему вы опоздали?\n— Поздно вышел заранее.";

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

  function getProfileName() {
    var settings = loadUserSettings();
    return typeof settings.name === "string" && settings.name.trim()
      ? settings.name.trim()
      : "Венера";
  }

  function getGreeting(hour) {
    var name = getProfileName();
    if (hour >= 5 && hour < 12) return "Доброе утро, " + name;
    if (hour >= 12 && hour < 18) return "Добрый день, " + name;
    if (hour >= 18 && hour < 23) return "Добрый вечер, " + name;
    return "Доброй ночи, " + name;
  }

  function isTodayBirthday(birthDate, today) {
    var match = typeof birthDate === "string" && birthDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!match) return false;

    return (
      Number(match[1]) === today.getMonth() + 1 &&
      Number(match[2]) === today.getDate()
    );
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

  function getTodaysBirthdays(today) {
    return loadBirthdays().filter(function (birthday) {
      return birthday && isTodayBirthday(birthday.birthDate, today);
    });
  }

  function formatDate(date) {
    var weekday = WEEKDAYS[date.getDay()].toLowerCase();
    var day = date.getDate();
    var month = MONTHS[date.getMonth()];
    return "Сегодня " + day + " " + month + ", " + weekday;
  }

  function getTodayTasks() {
    return tasksStorage.getTasksForDate(tasksStorage.getDateKey(new Date()));
  }

  function saveTasksForToday(tasks) {
    tasksStorage.saveTasksForDate(tasksStorage.getDateKey(new Date()), tasks);
  }

  function formatFullDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function parseDateParts(value) {
    if (typeof value !== "string") return null;

    var match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3])
    };
  }

  function formatImportantDateCategory(category) {
    if (typeof category !== "string") return "Важная дата";
    var value = category.trim();
    if (!value) return "Важная дата";
    return IMPORTANT_DATE_CATEGORY_LABELS[value] || value;
  }

  function loadImportantDates() {
    if (
      window.MyDayImportantDatesStorage &&
      typeof window.MyDayImportantDatesStorage.loadImportantDates === "function"
    ) {
      return window.MyDayImportantDatesStorage.loadImportantDates() || [];
    }

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

  function isImportantDateToday(item, today) {
    if (!item || typeof item.date !== "string") return false;

    var parts = parseDateParts(item.date);
    if (!parts) return false;

    if (item.yearly) {
      return (
        parts.month === today.getMonth() + 1 &&
        parts.day === today.getDate()
      );
    }

    return item.date.trim() === formatFullDateKey(today);
  }

  function getCalendarEventsForToday(today) {
    if (!window.MyDayHolidays || typeof window.MyDayHolidays.getCalendarEventsOnDate !== "function") {
      return [];
    }

    return window.MyDayHolidays.getCalendarEventsOnDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    ) || [];
  }

  function getTodayCalendarEntries(today) {
    var entries = [];

    loadImportantDates().forEach(function (item) {
      if (!isImportantDateToday(item, today)) return;

      var title = typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "—";

      entries.push({
        label: formatImportantDateCategory(item.category),
        text: title
      });
    });

    getCalendarEventsForToday(today).forEach(function (event) {
      if (!event) return;

      var title = typeof event.title === "string" && event.title.trim()
        ? event.title.trim()
        : "—";

      entries.push({
        label: event.typeLabel || "Календарная дата",
        text: title
      });
    });

    return entries;
  }

  function renderCalendarEntry(label, text) {
    var item = document.createElement("div");
    item.className = "calendar__item";

    var body = document.createElement("div");

    var itemLabel = document.createElement("p");
    itemLabel.className = "calendar__label";
    itemLabel.textContent = label;

    var itemText = document.createElement("p");
    itemText.className = "calendar__text";
    itemText.textContent = text;

    body.appendChild(itemLabel);
    body.appendChild(itemText);
    item.appendChild(body);
    return item;
  }

  // Временный тестовый режим: index.html?date=YYYY-MM-DD
  // влияет только на блок «Праздники и даты».
  function getQueryParam(name) {
    var search = "";
    try {
      search = String(window.location.search || "");
    } catch (error) {
      search = "";
    }

    if (!search) {
      try {
        var href = String(window.location.href || "");
        var qIndex = href.indexOf("?");
        if (qIndex !== -1) {
          var hashIndex = href.indexOf("#", qIndex);
          search = hashIndex === -1 ? href.slice(qIndex) : href.slice(qIndex, hashIndex);
        }
      } catch (error2) {
        search = "";
      }
    }

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

    return null;
  }

  function getCalendarPreviewDate() {
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

  function renderCalendar() {
    var container = document.getElementById("calendar-content");
    if (!container) return;

    var previewDate = getCalendarPreviewDate();
    container.innerHTML = "";
    container.setAttribute(
      "data-calendar-date",
      formatFullDateKey(previewDate)
    );

    var entries = getTodayCalendarEntries(previewDate);

    if (!entries.length) {
      var empty = document.createElement("p");
      empty.className = "calendar__empty";
      empty.textContent = CALENDAR_EMPTY_TEXT;
      container.appendChild(empty);
      return;
    }

    entries.forEach(function (entry) {
      container.appendChild(renderCalendarEntry(entry.label, entry.text));
    });
  }

  function createTaskElement(task, isCompletedList) {
    var li = document.createElement("li");
    li.className = "task" + (task.done ? " task--done" : "");
    li.dataset.id = String(task.id);

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task__checkbox";
    checkbox.id = (isCompletedList ? "completed-task-" : "task-") + task.id;
    checkbox.checked = Boolean(task.done);
    checkbox.setAttribute("aria-label", task.text);

    var label = document.createElement("label");
    label.className = "task__label";
    label.htmlFor = checkbox.id;
    label.textContent = task.text;

    checkbox.addEventListener("change", function () {
      var todayTasks = getTodayTasks();
      var currentTask = todayTasks.find(function (item) {
        return item.id === task.id;
      });

      if (!currentTask) return;

      if (!currentTask.done && checkbox.checked) {
        li.classList.add("task--leaving");
        window.setTimeout(function () {
          currentTask.done = true;
          saveTasksForToday(todayTasks);
          renderTasks();
        }, 420);
        return;
      }

      currentTask.done = checkbox.checked;
      saveTasksForToday(todayTasks);
      renderTasks();
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    return li;
  }

  function renderTasks() {
    var activeList = document.getElementById("tasks-list");
    var completedList = document.getElementById("completed-tasks-list");
    var completedToggle = document.getElementById("completed-toggle");
    var completedCount = document.getElementById("completed-count");

    if (!activeList || !completedList || !completedToggle || !completedCount) return;

    activeList.innerHTML = "";
    completedList.innerHTML = "";

    var todayTasks = getTodayTasks();
    var activeTasks = todayTasks.filter(function (task) {
      return !task.done;
    });
    var completedTasks = todayTasks.filter(function (task) {
      return task.done;
    });

    activeTasks.forEach(function (task) {
      activeList.appendChild(createTaskElement(task, false));
    });

    completedTasks.forEach(function (task) {
      completedList.appendChild(createTaskElement(task, true));
    });

    completedCount.textContent = String(completedTasks.length);
    completedToggle.hidden = false;
    completedList.hidden = true;

    if (activeTasks.length === 0) {
      var empty = document.createElement("li");
      empty.className = "task task--done";
      empty.textContent = "На сегодня всё выполнено. Можно немного выдохнуть.";
      activeList.appendChild(empty);
    }

  }

  function addTask() {
    var input = document.getElementById("task-input");
    if (!input) return;

    var text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    tasksStorage.addTaskForDate(tasksStorage.getDateKey(new Date()), text);
    input.value = "";
    renderTasks();
    input.focus();
  }

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function initHeader() {
    var now = new Date();
    var greetingEl = document.getElementById("greeting");
    var dateEl     = document.getElementById("date");
    var statusTimeEl = document.getElementById("statusbar-time");

    if (greetingEl) greetingEl.textContent = getGreeting(now.getHours());
    if (dateEl)     dateEl.textContent     = formatDate(now);
    if (statusTimeEl) statusTimeEl.textContent = formatTime(now);

    window.setInterval(function () {
      var t = new Date();
      if (greetingEl) greetingEl.textContent = getGreeting(t.getHours());
      if (statusTimeEl) statusTimeEl.textContent = formatTime(t);
    }, 60000);
  }

  function initContent() {
    var smileEl = document.getElementById("smile-text");
    var now = new Date();

    renderCalendar();
    renderCongratulations(now);
    if (smileEl) smileEl.textContent = JOKE;
  }

  function renderCongratulations(today) {
    var card = document.getElementById("birthday-card");
    var name = document.getElementById("birthday-name");
    var when = document.getElementById("birthday-when");
    var greetBtn = document.getElementById("greet-btn");
    var modalTitle = document.getElementById("bday-modal-title-text");
    var modalText = document.getElementById("bday-modal-text");
    var todaysBirthdays = getTodaysBirthdays(today);

    if (!card) return;

    card.hidden = false;

    if (!todaysBirthdays.length) {
      if (name) name.textContent = "Сегодня нет поводов для поздравлений";
      if (when) when.textContent = "";
      if (greetBtn) greetBtn.hidden = true;
      return;
    }

    var personName = typeof todaysBirthdays[0].name === "string" && todaysBirthdays[0].name.trim()
      ? todaysBirthdays[0].name.trim()
      : "—";

    if (name) name.textContent = personName;
    if (when) when.textContent = "сегодня";
    if (greetBtn) greetBtn.hidden = false;
    if (modalTitle) modalTitle.innerHTML = "С днём рождения,<br>" + personName + "!";
    if (modalText) {
      modalText.textContent =
        "Желаю здоровья, душевного тепла, радостных событий и как можно больше поводов улыбаться!";
    }
  }

  function initButtons() {
    var addBtn = document.getElementById("add-task-btn");
    var taskInput = document.getElementById("task-input");
    var completedToggle = document.getElementById("completed-toggle");
    var completedList = document.getElementById("completed-tasks-list");

    if (addBtn) addBtn.addEventListener("click", addTask);

    if (taskInput) {
      taskInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") addTask();
      });
    }

    if (completedToggle && completedList) {
      completedToggle.addEventListener("click", function () {
        completedList.hidden = !completedList.hidden;
      });
    }

  }

  function initModal() {
    var overlay   = document.getElementById("bday-modal");
    var backdrop  = document.getElementById("bday-modal-backdrop");
    var closeBtn  = document.getElementById("bday-modal-close");
    var copyBtn   = document.getElementById("bday-copy-btn");
    var shareBtn  = document.getElementById("bday-share-btn");
    var greetBtn  = document.getElementById("greet-btn");
    var modalText = document.getElementById("bday-modal-text");

    if (!overlay) return;

    function getGreetingText() {
      var title = document.getElementById("bday-modal-title-text");
      var text = document.getElementById("bday-modal-text");
      return (title ? title.textContent : "С днём рождения!") + "\n\n" +
        (text ? text.textContent : "");
    }

    function openModal() {
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
    }

    function closeModal() {
      overlay.hidden = true;
      document.body.style.overflow = "";
    }

    if (greetBtn)  greetBtn.addEventListener("click",   openModal);
    if (closeBtn)  closeBtn.addEventListener("click",   closeModal);
    if (backdrop)  backdrop.addEventListener("click",   closeModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeModal();
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        var original = copyBtn.textContent;
        try {
          navigator.clipboard.writeText(getGreetingText()).then(function () {
            copyBtn.textContent = "Скопировано!";
            window.setTimeout(function () { copyBtn.textContent = original; }, 2000);
          });
        } catch (err) {
          copyBtn.textContent = "Скопировано!";
          window.setTimeout(function () { copyBtn.textContent = original; }, 2000);
        }
      });
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        if (navigator.share) {
          navigator.share({ text: getGreetingText() });
        } else {
          var original = shareBtn.textContent;
          try {
            navigator.clipboard.writeText(getGreetingText()).then(function () {
              shareBtn.textContent = "Скопировано!";
              window.setTimeout(function () { shareBtn.textContent = original; }, 2000);
            });
          } catch (err) {
            shareBtn.textContent = "Скопировано!";
            window.setTimeout(function () { shareBtn.textContent = original; }, 2000);
          }
        }
      });
    }
  }

  function loadTasksStorage(callback) {
    if (window.MyDayTasksStorage) {
      tasksStorage = window.MyDayTasksStorage;
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
      callback();
    });

    if (!script.parentNode) {
      document.head.appendChild(script);
    }
  }

  function init() {
    initHeader();
    renderTasks();
    initContent();
    initButtons();
    initModal();
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

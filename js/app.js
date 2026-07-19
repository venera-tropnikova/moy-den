(function () {
  "use strict";

  var STORAGE_KEY = "my-day-date-tasks-v1";

  var WEEKDAYS = [
    "Воскресенье", "Понедельник", "Вторник", "Среда",
    "Четверг", "Пятница", "Суббота"
  ];

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var CALENDAR_BY_DATE = {
    "01-01": {
      holiday: "[Демо] Новый год",
      history: "[Демо] Здесь будет проверенное историческое событие этого дня.",
      fact: "[Демо] Здесь будет короткий факт, связанный с 1 января."
    },
    "03-08": {
      holiday: "[Демо] Международный женский день",
      history: "[Демо] Здесь будет проверенное историческое событие этого дня.",
      fact: "[Демо] Здесь будет короткий факт, связанный с 8 марта."
    },
    "07-17": {
      holiday: "[Демо] Памятная дата проекта «Мой день»",
      history: "[Демо] Здесь будет проверенное историческое событие этого дня.",
      fact: "[Демо] Здесь будет короткий факт, связанный с 17 июля."
    },
    "07-18": {
      holiday: "[Демо] День спокойного утра",
      history: "[Демо] Здесь будет проверенное историческое событие этого дня.",
      fact: "[Демо] Здесь будет короткий факт, связанный с 18 июля."
    },
    "12-31": {
      holiday: "[Демо] Канун Нового года",
      history: "[Демо] Здесь будет проверенное историческое событие этого дня.",
      fact: "[Демо] Здесь будет короткий факт, связанный с 31 декабря."
    }
  };

  var CALENDAR_EMPTY_TEXT =
    "Сегодня нет добавленных событий. Позже здесь появятся праздники и памятные даты.";

  var JOKE =
    "— Почему вы опоздали?\n— Поздно вышел заранее.";

  var DAILY_THOUGHTS = [
    "Сегодня не обязательно успеть всё. Достаточно сделать главное.",
    "Спокойный шаг тоже ведёт вперёд.",
    "Хороший день начинается не с идеального плана, а с первого осмысленного действия.",
    "Иногда лучший способ двигаться быстрее — перестать торопиться.",
    "Пусть сегодня будет место не только делам, но и вниманию к себе.",
    "Маленькое завершённое дело ценнее десяти начатых.",
    "Не каждый день должен быть выдающимся. Иногда достаточно, чтобы он был вашим."
  ];

  function loadTasksByDate() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};

      var parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить задачи:", error);
      return {};
    }
  }

  function saveTasksByDate(tasksByDate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
    } catch (error) {
      console.warn("Не удалось сохранить задачи:", error);
    }
  }

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return "Доброе утро,\nВенера!";
    if (hour >= 12 && hour < 18) return "Добрый день,\nВенера!";
    if (hour >= 18 && hour < 23) return "Добрый вечер,\nВенера!";
    return "Доброй ночи,\nВенера!";
  }

  function formatDate(date) {
    var weekday = WEEKDAYS[date.getDay()];
    var day = date.getDate();
    var month = MONTHS[date.getMonth()];
    return weekday + ", " + day + " " + month;
  }

  function getDateKey(date) {
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return month + "-" + day;
  }

  function getTaskDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function getTodayTasks() {
    var tasksByDate = loadTasksByDate();
    var tasks = tasksByDate[getTaskDateKey(new Date())];
    return Array.isArray(tasks) ? tasks : [];
  }

  function saveTasksForToday(tasks) {
    var tasksByDate = loadTasksByDate();
    tasksByDate[getTaskDateKey(new Date())] = tasks;
    saveTasksByDate(tasksByDate);
  }

  function getThoughtForToday(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((date - start) / 86400000);
    return DAILY_THOUGHTS[dayOfYear % DAILY_THOUGHTS.length];
  }

  function renderCalendarEntry(label, text) {
    var item = document.createElement("div");
    item.className = "calendar__item";

    var itemLabel = document.createElement("p");
    itemLabel.className = "calendar__label";
    itemLabel.textContent = label;

    var itemText = document.createElement("p");
    itemText.className = "calendar__text";
    itemText.textContent = text;

    item.appendChild(itemLabel);
    item.appendChild(itemText);
    return item;
  }

  function renderCalendar() {
    var container = document.getElementById("calendar-content");
    if (!container) return;

    container.innerHTML = "";
    var entry = CALENDAR_BY_DATE[getDateKey(new Date())];

    if (!entry) {
      var empty = document.createElement("p");
      empty.className = "calendar__empty";
      empty.textContent = CALENDAR_EMPTY_TEXT;
      container.appendChild(empty);
      return;
    }

    container.appendChild(renderCalendarEntry("Праздник", entry.holiday));
    container.appendChild(renderCalendarEntry("В этот день", entry.history));
    container.appendChild(renderCalendarEntry("Факт дня", entry.fact));
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

    var todayTasks = getTodayTasks();
    todayTasks.push({
      id: Date.now(),
      text: text
    });

    saveTasksForToday(todayTasks);
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
    var moodEl = document.getElementById("mood-text");
    var now = new Date();

    renderCalendar();
    if (smileEl) smileEl.textContent = JOKE;
    if (moodEl) moodEl.textContent = getThoughtForToday(now);
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

    var fullText =
      "Венера, с днём рождения! 🎂\n\n" +
      "Желаю здоровья, душевного тепла, радостных событий " +
      "и как можно больше поводов улыбаться!";

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
          navigator.clipboard.writeText(fullText).then(function () {
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
          navigator.share({ text: fullText });
        } else {
          var original = shareBtn.textContent;
          try {
            navigator.clipboard.writeText(fullText).then(function () {
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

  function init() {
    initHeader();
    renderTasks();
    initContent();
    initButtons();
    initModal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

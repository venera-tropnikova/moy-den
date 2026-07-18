(function () {
  "use strict";

  var STORAGE_KEY = "my-day-tasks-v1";

  var WEEKDAYS = [
    "Воскресенье", "Понедельник", "Вторник", "Среда",
    "Четверг", "Пятница", "Суббота"
  ];

  var MONTHS = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var DEFAULT_TASKS = [
    { id: 1, text: "Посмотреть урок Cursor", done: false },
    { id: 2, text: "Купить продукты", done: false },
    { id: 3, text: "Позвонить маме", done: true }
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

  var SMILE =
    "План на день был прекрасен. Но у дня, как обычно, оказался собственный план.";

  var DAILY_THOUGHTS = [
    "Сегодня не обязательно успеть всё. Достаточно сделать главное.",
    "Спокойный шаг тоже ведёт вперёд.",
    "Хороший день начинается не с идеального плана, а с первого осмысленного действия.",
    "Иногда лучший способ двигаться быстрее — перестать торопиться.",
    "Пусть сегодня будет место не только делам, но и вниманию к себе.",
    "Маленькое завершённое дело ценнее десяти начатых.",
    "Не каждый день должен быть выдающимся. Иногда достаточно, чтобы он был вашим."
  ];

  var tasks = loadTasks();

  function loadTasks() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return DEFAULT_TASKS.slice();

      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : DEFAULT_TASKS.slice();
    } catch (error) {
      console.warn("Не удалось загрузить задачи:", error);
      return DEFAULT_TASKS.slice();
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.warn("Не удалось сохранить задачи:", error);
    }
  }

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return "Доброе утро!";
    if (hour >= 12 && hour < 18) return "Добрый день!";
    if (hour >= 18 && hour < 23) return "Добрый вечер!";
    return "Доброй ночи!";
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

  function updateProgress() {
    var progress = document.getElementById("tasks-progress");
    if (!progress) return;

    var completed = tasks.filter(function (task) {
      return task.done;
    }).length;

    progress.textContent = completed + " из " + tasks.length + " выполнено";
  }

  function createTaskElement(task, isCompletedList) {
    var li = document.createElement("li");
    li.className = "task" + (task.done ? " task--done" : "");
    li.dataset.id = String(task.id);

    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task__checkbox";
    checkbox.id = (isCompletedList ? "completed-task-" : "task-") + task.id;
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", task.text);

    var label = document.createElement("label");
    label.className = "task__label";
    label.htmlFor = checkbox.id;
    label.textContent = task.text;

    var deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "task__delete";
    deleteButton.setAttribute("aria-label", "Удалить задачу: " + task.text);
    deleteButton.textContent = "×";

    checkbox.addEventListener("change", function () {
      if (!task.done && checkbox.checked) {
        li.classList.add("task--leaving");
        window.setTimeout(function () {
          task.done = true;
          saveTasks();
          renderTasks();
        }, 420);
        return;
      }

      task.done = checkbox.checked;
      saveTasks();
      renderTasks();
    });

    deleteButton.addEventListener("click", function () {
      tasks = tasks.filter(function (item) {
        return item.id !== task.id;
      });
      saveTasks();
      renderTasks();
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    li.appendChild(deleteButton);
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

    var activeTasks = tasks.filter(function (task) {
      return !task.done;
    });

    var completedTasks = tasks.filter(function (task) {
      return task.done;
    });

    activeTasks.forEach(function (task) {
      activeList.appendChild(createTaskElement(task, false));
    });

    completedTasks.forEach(function (task) {
      completedList.appendChild(createTaskElement(task, true));
    });

    completedCount.textContent = String(completedTasks.length);
    completedToggle.hidden = completedTasks.length === 0;

    if (activeTasks.length === 0) {
      var empty = document.createElement("li");
      empty.className = "task task--done";
      empty.textContent = "На сегодня всё выполнено. Можно немного выдохнуть.";
      activeList.appendChild(empty);
    }

    updateProgress();
  }

  function addTask() {
    var input = document.getElementById("task-input");
    if (!input) return;

    var text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    tasks.push({
      id: Date.now(),
      text: text,
      done: false
    });

    input.value = "";
    saveTasks();
    renderTasks();
    input.focus();
  }

  function initHeader() {
    var now = new Date();
    var greetingEl = document.getElementById("greeting");
    var dateEl = document.getElementById("date");

    if (greetingEl) greetingEl.textContent = getGreeting(now.getHours());
    if (dateEl) dateEl.textContent = formatDate(now);
  }

  function initContent() {
    var smileEl = document.getElementById("smile-text");
    var moodEl = document.getElementById("mood-text");
    var now = new Date();

    renderCalendar();
    if (smileEl) smileEl.textContent = SMILE;
    if (moodEl) moodEl.textContent = getThoughtForToday(now);
  }

  function initButtons() {
    var addBtn = document.getElementById("add-task-btn");
    var taskInput = document.getElementById("task-input");
    var greetBtn = document.getElementById("greet-btn");
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

    if (greetBtn) {
      greetBtn.addEventListener("click", function () {
        alert(
          "Ирина, с днём рождения! 🎂\n\n" +
          "Желаю здоровья, душевного тепла, радостных событий " +
          "и как можно больше поводов улыбаться!"
        );
      });
    }
  }

  function init() {
    initHeader();
    renderTasks();
    initContent();
    initButtons();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

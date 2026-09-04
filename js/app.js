(function () {
  "use strict";

  var tasksStorage = null;
  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var IMPORTANT_DATES_KEY = "my-day-important-dates-v1";

  var targetDate = parseTargetDate();

  window.MyDayTargetDate = targetDate;

  var eventsCardMode = "image";
  var eventsCardBound = false;
  var eventsFeaturedEntry = null;
  var invalidateTaskVoiceInput = function () {};

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

  function parseTargetDate() {
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

  function isCurrentDate(date) {
    var now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  function isPastDate(date) {
    var now = new Date();
    var selected = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return selected < today;
  }

  function getTargetDateKey() {
    return tasksStorage.getDateKey(targetDate);
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
    var prefix = isCurrentDate(date) ? "Сегодня " : "";
    return prefix + day + " " + month + ", " + weekday;
  }

  function getTodayTasks() {
    return tasksStorage.getTasksForDate(getTargetDateKey());
  }

  function saveTasksForToday(tasks) {
    tasksStorage.saveTasksForDate(getTargetDateKey(), tasks);
  }

  function getTomorrowDateKey() {
    var tomorrow = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    tomorrow.setHours(12, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tasksStorage.getDateKey(tomorrow);
  }

  function closeAllTaskMenus(exceptMenu) {
    var menus = document.querySelectorAll(".task__menu.is-open");
    for (var i = 0; i < menus.length; i += 1) {
      if (exceptMenu && menus[i] === exceptMenu) continue;
      menus[i].classList.remove("is-open");
      var btn = menus[i].querySelector(".task__menu-btn");
      var panel = menus[i].querySelector(".task__menu-dropdown");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (panel) panel.hidden = true;
    }
  }

  function removeTaskFromToday(taskId) {
    var todayKey = getTargetDateKey();
    var todayTasks = tasksStorage.getTasksForDate(todayKey);
    var removed = null;
    var remaining = [];

    for (var i = 0; i < todayTasks.length; i += 1) {
      if (String(todayTasks[i].id) === String(taskId)) {
        removed = todayTasks[i];
      } else {
        remaining.push(todayTasks[i]);
      }
    }

    if (!removed) return null;

    tasksStorage.saveTasksForDate(todayKey, remaining);
    return removed;
  }

  function moveTaskToDate(taskId, targetDateKey) {
    var todayKey = getTargetDateKey();
    if (!targetDateKey || targetDateKey === todayKey) return false;

    var removed = removeTaskFromToday(taskId);
    if (!removed) return false;

    var targetTasks = tasksStorage.getTasksForDate(targetDateKey);
    targetTasks.push({
      id: removed.id,
      text: removed.text,
      done: false
    });
    tasksStorage.saveTasksForDate(targetDateKey, targetTasks);
    return true;
  }

  function deleteTaskFromToday(taskId) {
    return Boolean(removeTaskFromToday(taskId));
  }

  function pickDateForTask(taskId) {
    var todayKey = getTargetDateKey();
    var input = document.createElement("input");
    input.type = "date";
    input.className = "task__date-input";
    input.setAttribute("aria-label", "Выбрать дату");
    document.body.appendChild(input);

    function cleanup() {
      if (input.parentNode) input.parentNode.removeChild(input);
    }

    input.addEventListener("change", function () {
      var value = input.value;
      cleanup();
      if (!value || value === todayKey) return;
      if (moveTaskToDate(taskId, value)) {
        renderTasks();
      }
    });

    input.addEventListener("blur", function () {
      window.setTimeout(cleanup, 200);
    });

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch (err) {}
    }

    input.focus();
    input.click();
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

  function formatCalendarCardDate(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return "";
    var monthName = MONTHS[date.getMonth()];
    if (!monthName) return "";
    return date.getDate() + " " + monthName;
  }

  function isSafeLocalHolidayImage(path) {
    if (typeof path !== "string") return false;
    var trimmed = path.trim();
    if (!trimmed) return false;
    if (trimmed.indexOf("assets/") !== 0) return false;
    if (trimmed.indexOf("://") !== -1) return false;
    if (trimmed.indexOf("..") !== -1) return false;
    return true;
  }

  function getTodayCalendarEntries(today) {
    var entries = [];
    var dateLabel = formatCalendarCardDate(today);

    loadImportantDates().forEach(function (item) {
      if (!isImportantDateToday(item, today)) return;

      var title = typeof item.title === "string" && item.title.trim()
        ? item.title.trim()
        : "—";

      entries.push({
        kind: "personal",
        type: "",
        title: title,
        summary: "",
        dateLabel: dateLabel
      });
    });

    getCalendarEventsForToday(today).forEach(function (event) {
      if (!event) return;

      var title = typeof event.title === "string" && event.title.trim()
        ? event.title.trim()
        : "—";
      var summary = typeof event.summary === "string"
        ? event.summary.trim()
        : "";

      var calendarEntry = {
        kind: "calendar",
        type: event.type || "",
        title: title,
        summary: summary,
        dateLabel: dateLabel
      };

      if (typeof event.shortTitle === "string" && event.shortTitle.trim()) {
        calendarEntry.shortTitle = event.shortTitle.trim();
      }

      if (isSafeLocalHolidayImage(event.image)) {
        calendarEntry.image = event.image.trim();
      }

      entries.push(calendarEntry);
    });

    return entries;
  }

  function pickMainCalendarEntry(entries) {
    var i;
    for (i = 0; i < entries.length; i += 1) {
      if (entries[i].type === "official-holiday") return entries[i];
    }
    for (i = 0; i < entries.length; i += 1) {
      if (entries[i].kind === "calendar") return entries[i];
    }
    return entries[0] || null;
  }

  function isEventsInteractiveTarget(target) {
    var el = target;
    if (!el) return false;
    if (el.nodeType === 3) el = el.parentElement;
    if (!el || !el.closest) return false;
    return Boolean(
      el.closest(
        "a, button, input, textarea, select, [contenteditable], [role='button']"
      )
    );
  }

  function getEventsCard() {
    return document.querySelector(".card--events");
  }

  function applyEventsCardMode(card, entry, mode) {
    if (!card) return;

    eventsCardMode = mode === "text" ? "text" : "image";
    card.classList.remove("card--events-image", "card--events-text");
    card.classList.add(
      eventsCardMode === "text" ? "card--events-text" : "card--events-image"
    );
    card.setAttribute(
      "aria-expanded",
      eventsCardMode === "text" ? "true" : "false"
    );

    var titleEl = card.querySelector(".calendar__featured-title");
    if (!titleEl || !entry) return;

    if (eventsCardMode === "image") {
      titleEl.textContent = entry.shortTitle || entry.title || "—";
    } else {
      titleEl.textContent = entry.title || "—";
    }
  }

  function toggleEventsCardMode() {
    var card = getEventsCard();
    if (!card || !eventsFeaturedEntry) return;
    applyEventsCardMode(
      card,
      eventsFeaturedEntry,
      eventsCardMode === "image" ? "text" : "image"
    );
  }

  function bindEventsCardInteractions() {
    var card = getEventsCard();
    if (!card || eventsCardBound) return;
    eventsCardBound = true;

    card.addEventListener("click", function (event) {
      if (!eventsFeaturedEntry) return;
      if (isEventsInteractiveTarget(event.target)) return;
      toggleEventsCardMode();
    });

    card.addEventListener("keydown", function (event) {
      if (!eventsFeaturedEntry) return;
      if (isEventsInteractiveTarget(event.target)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleEventsCardMode();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        applyEventsCardMode(card, eventsFeaturedEntry, "image");
      }
    });

    var footerBtn = card.querySelector(":scope > .link-btn");
    if (footerBtn) {
      footerBtn.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }
  }

  function renderFeaturedCalendarEntry(entry) {
    var wrap = document.createElement("div");
    wrap.className = "calendar__featured";

    var top = document.createElement("div");
    top.className = "calendar__featured-top";

    if (isSafeLocalHolidayImage(entry.image)) {
      var img = document.createElement("img");
      img.className = "calendar__featured-image";
      img.src = entry.image.trim();
      img.alt = entry.shortTitle || entry.title || "";
      img.setAttribute("decoding", "async");
      top.appendChild(img);
    }

    var meta = document.createElement("div");
    meta.className = "calendar__featured-meta";

    var title = document.createElement("p");
    title.className = "calendar__featured-title";
    title.textContent = entry.shortTitle || entry.title || "—";
    meta.appendChild(title);

    if (entry.dateLabel) {
      var dateEl = document.createElement("p");
      dateEl.className = "calendar__featured-date";
      dateEl.textContent = entry.dateLabel;
      meta.appendChild(dateEl);
    }

    top.appendChild(meta);
    wrap.appendChild(top);

    if (entry.summary) {
      var summaryEl = document.createElement("p");
      summaryEl.className = "calendar__featured-summary";
      summaryEl.textContent = entry.summary;
      wrap.appendChild(summaryEl);
    }

    return wrap;
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
    return targetDate;
  }

  function renderCalendar() {
    var container = document.getElementById("calendar-content");
    if (!container) return;

    eventsFeaturedEntry = null;

    var card = getEventsCard();
    var previewDate = getCalendarPreviewDate();
    container.innerHTML = "";
    container.setAttribute(
      "data-calendar-date",
      formatFullDateKey(previewDate)
    );

    var entries = getTodayCalendarEntries(previewDate);

    if (!entries.length) {
      if (card) {
        card.classList.remove("card--events-image", "card--events-text");
        card.classList.add("card--events-empty");
        card.removeAttribute("aria-expanded");
        card.tabIndex = -1;
      }

      var emptyState = document.createElement("div");
      emptyState.className = "calendar__empty-state";

      var emptyCopy = document.createElement("div");
      emptyCopy.className = "calendar__empty-copy";

      var empty = document.createElement("p");
      empty.className = "calendar__empty";
      empty.textContent = isCurrentDate(previewDate)
        ? "Сегодня особых дат нет"
        : "В этот день особых дат нет";
      emptyCopy.appendChild(empty);

      var caption = document.createElement("p");
      caption.className = "calendar__empty-caption";
      caption.textContent = "Просто хороший день для своих планов.";
      emptyCopy.appendChild(caption);

      emptyState.appendChild(emptyCopy);

      var emptyPhoto = document.createElement("div");
      emptyPhoto.className = "calendar__empty-photo";
      emptyPhoto.setAttribute("aria-hidden", "true");

      var emptyImg = document.createElement("img");
      emptyImg.src = "assets/holidays/empty-cozy-window.png";
      emptyImg.alt = "";
      emptyImg.decoding = "async";
      emptyPhoto.appendChild(emptyImg);

      emptyState.appendChild(emptyPhoto);
      container.appendChild(emptyState);
      return;
    }

    if (card) {
      card.classList.remove("card--events-empty");
    }

    var main = pickMainCalendarEntry(entries);
    if (main) {
      eventsFeaturedEntry = main;
      container.appendChild(renderFeaturedCalendarEntry(main));
      if (card) {
        card.classList.remove("card--events-image", "card--events-text");
        card.removeAttribute("aria-expanded");
        card.tabIndex = -1;
      }
    }

    if (entries.length > 1) {
      var more = document.createElement("button");
      more.type = "button";
      more.className = "calendar__more";
      more.textContent = "Ещё " + (entries.length - 1) + " →";
      container.appendChild(more);
    }

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

    // span без for — клик по тексту не связан с checkbox
    var label = document.createElement("span");
    label.className = "task__label";
    label.textContent = task.text;
    label.setAttribute("role", "button");
    label.setAttribute("tabindex", "0");
    label.setAttribute("aria-label", "Редактировать задачу");

    function startEditing() {
      if (li.classList.contains("task--editing")) return;

      var originalText = label.textContent || "";
      var input = document.createElement("input");
      var finishing = false;
      var canCommitOnBlur = false;

      input.type = "text";
      input.className = "task__edit";
      input.value = originalText;
      input.setAttribute("aria-label", "Текст задачи");
      input.maxLength = 200;

      li.classList.add("task--editing");
      label.replaceWith(input);

      function restoreLabel(text) {
        label.textContent = text;
        checkbox.setAttribute("aria-label", text);
        if (input.parentNode) input.replaceWith(label);
        li.classList.remove("task--editing");
      }

      function commitEdit(shouldSave) {
        if (finishing) return;
        finishing = true;

        var nextText = shouldSave ? input.value.trim() : originalText;
        if (shouldSave && !nextText) {
          nextText = originalText;
        }

        if (shouldSave && nextText !== originalText) {
          var todayTasks = getTodayTasks();
          var currentTask = todayTasks.find(function (item) {
            return String(item.id) === String(task.id);
          });

          if (currentTask) {
            currentTask.text = nextText;
            saveTasksForToday(todayTasks);
          }
        }

        restoreLabel(nextText);
      }

      input.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          commitEdit(true);
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          commitEdit(false);
        }
      });

      // Нельзя слушать blur до конца жеста открытия:
      // тот же click, что открыл редактирование, иначе сразу снимет focus.
      input.addEventListener("blur", function () {
        if (!canCommitOnBlur) return;
        commitEdit(true);
      });

      input.focus();
      if (typeof input.setSelectionRange === "function") {
        try {
          input.setSelectionRange(input.value.length, input.value.length);
        } catch (err) {}
      }

      // Включить blur-сохранение только после завершения текущего click/pointer жеста.
      queueMicrotask(function () {
        canCommitOnBlur = true;
      });
    }

    // preventDefault на pointerdown удерживает focus и не даёт
    // браузеру «дожать» click так, чтобы новый input сразу потерял фокус.
    label.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      event.stopPropagation();
    });

    label.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      startEditing();
    });

    label.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        startEditing();
      }
    });

    checkbox.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    checkbox.addEventListener("change", function () {
      var todayTasks = getTodayTasks();
      var currentTask = todayTasks.find(function (item) {
        return String(item.id) === String(task.id);
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

    if (!isCompletedList && !task.done) {
      var menu = document.createElement("div");
      menu.className = "task__menu";

      var menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "task__menu-btn";
      menuBtn.setAttribute("aria-label", "Действия с задачей");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-haspopup", "true");
      menuBtn.textContent = "⋯";

      var dropdown = document.createElement("div");
      dropdown.className = "task__menu-dropdown";
      dropdown.hidden = true;
      dropdown.setAttribute("role", "menu");

      function addMenuOption(labelText, action) {
        var option = document.createElement("button");
        option.type = "button";
        option.className = "task__menu-option";
        if (action === "delete") {
          option.className += " task__menu-option--danger";
        }
        option.setAttribute("role", "menuitem");
        option.dataset.action = action;
        option.textContent = labelText;
        dropdown.appendChild(option);
      }

      addMenuOption("Перенести на завтра", "tomorrow");
      addMenuOption("Выбрать дату", "date");
      addMenuOption("Удалить", "delete");

      function setMenuOpen(open) {
        if (open) closeAllTaskMenus(menu);
        menu.classList.toggle("is-open", open);
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        dropdown.hidden = !open;
      }

      menuBtn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(dropdown.hidden);
      });

      dropdown.addEventListener("click", function (event) {
        event.stopPropagation();
        var option = event.target && event.target.closest
          ? event.target.closest("[data-action]")
          : null;
        if (!option) return;

        var action = option.getAttribute("data-action");
        setMenuOpen(false);

        if (action === "tomorrow") {
          if (moveTaskToDate(task.id, getTomorrowDateKey())) {
            renderTasks();
          }
          return;
        }

        if (action === "date") {
          pickDateForTask(task.id);
          return;
        }

        if (action === "delete") {
          if (window.confirm("Удалить задачу?")) {
            if (deleteTaskFromToday(task.id)) {
              renderTasks();
            }
          }
        }
      });

      menu.appendChild(menuBtn);
      menu.appendChild(dropdown);
      li.appendChild(menu);
    }

    return li;
  }

  function renderTasks() {
    var activeList = document.getElementById("tasks-list");
    var completedList = document.getElementById("completed-tasks-list");
    var completedToggle = document.getElementById("completed-toggle");
    var completedCount = document.getElementById("completed-count");

    if (!activeList || !completedList || !completedToggle || !completedCount) return;

    var past = isPastDate(targetDate);
    var titleEl = document.getElementById("tasks-lbl");
    if (titleEl) titleEl.textContent = past ? "План на этот день" : "План на сегодня";

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
    completedToggle.hidden = todayTasks.length === 0;
    completedToggle.style.display = todayTasks.length === 0 ? "none" : "";
    completedList.hidden = true;

    if (activeTasks.length === 0) {
      var empty = document.createElement("li");
      empty.className = "task task--done";
      empty.textContent = todayTasks.length === 0
        ? "Пока нет дел"
        : (past
          ? "На этот день всё выполнено. Можно немного выдохнуть."
          : "На сегодня всё выполнено. Можно немного выдохнуть.");
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

    tasksStorage.addTaskForDate(getTargetDateKey(), text);
    invalidateTaskVoiceInput();
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
    if (dateEl)     dateEl.textContent     = formatDate(targetDate);
    if (statusTimeEl) statusTimeEl.textContent = formatTime(now);

    window.setInterval(function () {
      var t = new Date();
      if (greetingEl) greetingEl.textContent = getGreeting(t.getHours());
      if (statusTimeEl) statusTimeEl.textContent = formatTime(t);
    }, 60000);
  }

  function initContent() {
    renderCalendar();
    renderCongratulations(targetDate);
  }

  function setBirthdayWishOpen(card, emptyEl, wishEl, open) {
    if (!card) return;

    card.classList.toggle("card--birthday-wish-open", open);
    card.setAttribute("aria-expanded", open ? "true" : "false");

    if (emptyEl) emptyEl.hidden = open;
    if (wishEl) wishEl.hidden = !open;

    if (!open) {
      var shareMenu = document.getElementById("bday-share-menu");
      var shareBtn = document.getElementById("bday-empty-share-btn");
      if (shareMenu) shareMenu.hidden = true;
      if (shareBtn) shareBtn.setAttribute("aria-expanded", "false");
    }
  }

  function setBirthdayEmptyMode(card, isEmpty) {
    var row = document.getElementById("bday-row");
    var emptyEl = document.getElementById("bday-empty");
    var wishEl = document.getElementById("bday-wish");

    if (!card) return;

    if (isEmpty) {
      if (row) row.hidden = true;
      card.classList.add("card--birthday-empty");
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.setAttribute("aria-controls", "bday-wish");
      setBirthdayWishOpen(card, emptyEl, wishEl, false);
      return;
    }

    if (row) row.hidden = false;
    if (emptyEl) emptyEl.hidden = true;
    if (wishEl) wishEl.hidden = true;
    card.classList.remove("card--birthday-empty", "card--birthday-wish-open");
    card.setAttribute("role", "note");
    card.removeAttribute("tabindex");
    card.removeAttribute("aria-expanded");
    card.removeAttribute("aria-controls");
  }

  function renderCongratulations(today) {
    var card = document.getElementById("birthday-card");
    var name = document.getElementById("birthday-name");
    var when = document.getElementById("birthday-when");
    var greetBtn = document.getElementById("greet-btn");
    var modalTitle = document.getElementById("bday-modal-title-text");
    var modalText = document.getElementById("bday-modal-text");
    var emptyImage = document.getElementById("bday-empty-image");
    var emptyText = document.querySelector(".bday__empty-text");
    var todaysBirthdays = getTodaysBirthdays(today);
    var ritualImages = [
      "assets/congratulations/empty-bouquet.jpg",
      "assets/congratulations/empty-bouquet-coffee.jpg",
      "assets/congratulations/empty-cozy.jpg"
    ];

    if (!card) return;

    card.hidden = false;

    if (emptyImage) {
      var dayIndex = Math.floor(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
      );
      emptyImage.src = ritualImages[Math.abs(dayIndex) % ritualImages.length];
    }

    if (!todaysBirthdays.length) {
      if (emptyText) {
        emptyText.innerHTML = isCurrentDate(today)
          ? "Сегодня нет поводов<br>для поздравлений."
          : "В этот день нет поводов<br>для поздравлений.";
      }
      setBirthdayEmptyMode(card, true);
      if (greetBtn) greetBtn.hidden = true;
      return;
    }

    setBirthdayEmptyMode(card, false);

    var personName = typeof todaysBirthdays[0].name === "string" && todaysBirthdays[0].name.trim()
      ? todaysBirthdays[0].name.trim()
      : "—";

    if (name) name.textContent = personName;
    if (when) when.textContent = isCurrentDate(today) ? "сегодня" : "в этот день";
    if (greetBtn) greetBtn.hidden = false;
    if (modalTitle) modalTitle.innerHTML = "С днём рождения,<br>" + personName + "!";
    if (modalText) {
      modalText.textContent =
        "Желаю здоровья, душевного тепла, радостных событий и как можно больше поводов улыбаться!";
    }
  }

  function initBirthdayEmptyCard() {
    var card = document.getElementById("birthday-card");
    var emptyEl = document.getElementById("bday-empty");
    var wishEl = document.getElementById("bday-wish");
    var wishInput = document.getElementById("bday-wish-input");
    var copyBtn = document.getElementById("bday-empty-copy-btn");
    var shareBtn = document.getElementById("bday-empty-share-btn");
    var shareMenu = document.getElementById("bday-share-menu");
    var statusEl = document.getElementById("bday-wish-status");
    var statusTimer = null;
    var DEFAULT_WISH =
      "Пусть сегодняшний день принесёт хотя бы одну приятную неожиданность.";

    if (!card || !emptyEl || !wishEl) return;

    function getWishText() {
      var title = "Доброго дня!";
      var body = wishInput && typeof wishInput.value === "string"
        ? wishInput.value.trim()
        : DEFAULT_WISH;
      return body ? title + "\n\n" + body : title;
    }

    function showStatus(message) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.classList.add("is-visible");
      if (statusTimer) window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(function () {
        statusEl.classList.remove("is-visible");
        statusEl.textContent = "";
      }, 2200);
    }

    function copyText(text, successMessage) {
      var message = successMessage || "Скопировано";

      function fallbackCopy() {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand("copy");
          showStatus(message);
        } catch (err) {
          showStatus("Не удалось скопировать");
        }
        document.body.removeChild(area);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showStatus(message);
        }).catch(function () {
          fallbackCopy();
        });
        return;
      }

      fallbackCopy();
    }

    function setShareMenuOpen(open) {
      if (shareMenu) shareMenu.hidden = !open;
      if (shareBtn) shareBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function closeWish() {
      setShareMenuOpen(false);
      setBirthdayWishOpen(card, emptyEl, wishEl, false);
    }

    function openWish() {
      if (wishInput && !wishInput.value.trim()) {
        wishInput.value = DEFAULT_WISH;
      }
      setShareMenuOpen(false);
      setBirthdayWishOpen(card, emptyEl, wishEl, true);
    }

    function toggleWish() {
      if (!card.classList.contains("card--birthday-empty")) return;
      var isOpen = card.getAttribute("aria-expanded") === "true";
      if (isOpen) {
        closeWish();
      } else {
        openWish();
      }
    }

    function isInteractiveTarget(target) {
      if (!target || !target.closest) return false;
      return Boolean(
        target.closest(".bday__wish-input") ||
        target.closest(".bday__wish-links") ||
        target.closest(".bday__share-menu") ||
        target.closest(".bday__wish-status")
      );
    }

    function shareViaTelegram(text) {
      var url = "https://t.me/share/url?text=" + encodeURIComponent(text);
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function shareViaWhatsApp(text) {
      var url = "https://wa.me/?text=" + encodeURIComponent(text);
      window.open(url, "_blank", "noopener,noreferrer");
    }

    function shareViaNative(text) {
      if (navigator.share) {
        navigator.share({ text: text }).catch(function () {});
        return;
      }

      copyText(
        text,
        "Текст скопирован — вставьте его в MAX или другой мессенджер"
      );
    }

    card.addEventListener("click", function (event) {
      if (!card.classList.contains("card--birthday-empty")) return;
      if (isInteractiveTarget(event.target)) return;
      toggleWish();
    });

    card.addEventListener("keydown", function (event) {
      if (!card.classList.contains("card--birthday-empty")) return;

      if (event.key === "Escape" && card.getAttribute("aria-expanded") === "true") {
        event.preventDefault();
        if (shareMenu && !shareMenu.hidden) {
          setShareMenuOpen(false);
          return;
        }
        closeWish();
        return;
      }

      if (isInteractiveTarget(event.target)) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleWish();
      }
    });

    if (copyBtn) {
      copyBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        var original = copyBtn.textContent;
        copyText(getWishText(), "Скопировано");
        copyBtn.textContent = "Скопировано";
        window.setTimeout(function () {
          copyBtn.textContent = original;
        }, 2000);
      });
    }

    if (shareBtn && shareMenu) {
      shareBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        setShareMenuOpen(shareMenu.hidden);
      });

      shareMenu.addEventListener("click", function (event) {
        event.stopPropagation();
        var option = event.target && event.target.closest
          ? event.target.closest("[data-share]")
          : null;
        if (!option) return;

        var type = option.getAttribute("data-share");
        var text = getWishText();

        if (type === "telegram") {
          shareViaTelegram(text);
        } else if (type === "whatsapp") {
          shareViaWhatsApp(text);
        } else if (type === "native") {
          shareViaNative(text);
        } else if (type === "copy") {
          copyText(text, "Скопировано");
        }

        setShareMenuOpen(false);
      });
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

    document.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest(".task__menu")) {
        return;
      }
      closeAllTaskMenus();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeAllTaskMenus();
      }
    });

    var navTasks = document.getElementById("nav-tasks");
    var plan = document.getElementById("plan");
    if (navTasks && plan) {
      navTasks.addEventListener("click", function () {
        plan.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }
  }

  function isAppleTouchDevice() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPod|iPad/.test(ua)) return true;
    if (navigator.platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  function initVoiceInput() {
    var voiceBtn = document.getElementById("task-voice-btn");
    var taskInput = document.getElementById("task-input");
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
        if (taskInput) taskInput.focus();
        showMicDictationHint(voiceBtn);
      });
      return;
    }
    if (!SpeechRecognition) return;

    voiceBtn.hidden = false;

    invalidateTaskVoiceInput = function () {
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
      var baseline = taskInput ? taskInput.value : "";

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
        if (taskInput) {
          taskInput.value = (baseline + (baseline && transcript && !/\s$/.test(baseline) ? " " : "") + transcript).slice(0, 200);
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
    if (window.MyDaySceneBackground) {
      window.MyDaySceneBackground.applyToScreen(document.querySelector(".screen"));
    }
    initHeader();
    renderTasks();
    initContent();
    initButtons();
    initVoiceInput();
    initBirthdayEmptyCard();
    initModal();

    var importantDatesDayLink = document.getElementById("important-dates-day-link");
    if (importantDatesDayLink) {
      importantDatesDayLink.href = "important-dates.html?date=" + formatFullDateKey(targetDate);
    }
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

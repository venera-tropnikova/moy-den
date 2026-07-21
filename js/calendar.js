(function () {
  "use strict";

  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var IMPORTANT_DATES_KEY = "my-day-important-dates-v1";

  var MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  var MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];

  var today = new Date();
  var visibleMonth = parseVisibleMonthFromQuery() || new Date(today.getFullYear(), today.getMonth(), 1);

  function parseVisibleMonthFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var cal = params.get("cal");
    var match = cal && cal.match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    var year = Number(match[1]);
    var month = Number(match[2]) - 1;
    if (!year || month < 0 || month > 11) return null;

    return new Date(year, month, 1);
  }

  function getCalParam(year, month) {
    return year + "-" + padDatePart(month + 1);
  }

  function syncCalendarQuery() {
    if (!window.history || !window.history.replaceState) return;

    var cal = getCalParam(visibleMonth.getFullYear(), visibleMonth.getMonth());
    window.history.replaceState({}, "", "calendar.html?cal=" + cal);
  }

  function parseDateParts(dateValue) {
    if (typeof dateValue !== "string") return null;
    var match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;

    var month = Number(match[2]);
    var day = Number(match[3]);
    if (!month || month < 1 || month > 12 || !day || day < 1 || day > 31) {
      return null;
    }

    return {
      year: Number(match[1]),
      month: month - 1,
      day: day
    };
  }

  function getPersonalBirthdayParts() {
    try {
      var saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (!saved) return null;

      var parsed = JSON.parse(saved);
      var birthDate = parsed && typeof parsed.birthDate === "string" ? parsed.birthDate : "";
      var parts = parseDateParts(birthDate);
      if (!parts) return null;

      return {
        month: parts.month,
        day: parts.day
      };
    } catch (error) {
      console.warn("Не удалось загрузить дату рождения:", error);
      return null;
    }
  }

  function isPersonalBirthday(birthday, month, day) {
    return Boolean(birthday && birthday.month === month && birthday.day === day);
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

  function getCongratulationDayKeys() {
    var keys = {};

    loadBirthdays().forEach(function (item) {
      var parts = parseDateParts(item && item.birthDate);
      if (!parts) return;
      keys[parts.month + "-" + parts.day] = true;
    });

    return keys;
  }

  function getImportantDateMarkers() {
    var markers = {
      yearly: {},
      once: {}
    };

    loadImportantDates().forEach(function (item) {
      if (!item || typeof item.date !== "string") return;

      var parts = parseDateParts(item.date);
      if (!parts) return;

      if (item.yearly) {
        markers.yearly[parts.month + "-" + parts.day] = true;
        return;
      }

      markers.once[item.date.trim()] = true;
    });

    return markers;
  }

  function hasCongratulation(keys, month, day) {
    return Boolean(keys[month + "-" + day]);
  }

  function hasImportantDate(markers, year, month, day) {
    if (!markers) return false;

    if (markers.yearly[month + "-" + day]) return true;

    return Boolean(markers.once[getDateParam(year, month, day)]);
  }

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function getMondayBasedOffset(date) {
    return (date.getDay() + 6) % 7;
  }

  function isToday(year, month, day) {
    return (
      year === today.getFullYear() &&
      month === today.getMonth() &&
      day === today.getDate()
    );
  }

  function createEmptyDay() {
    var empty = document.createElement("span");
    empty.className = "day day--empty";
    empty.setAttribute("aria-hidden", "true");
    return empty;
  }

  function padDatePart(value) {
    return String(value).padStart(2, "0");
  }

  function getDateParam(year, month, day) {
    return year + "-" + padDatePart(month + 1) + "-" + padDatePart(day);
  }

  function formatMonthDay(day, month) {
    return day + " " + MONTHS_GENITIVE[month];
  }

  var RELATION_GENITIVE = {
    мама: "мамы",
    папа: "папы",
    дочь: "дочери",
    сын: "сына",
    сестра: "сестры",
    брат: "брата",
    бабушка: "бабушки",
    дедушка: "дедушки",
    тётя: "тёти",
    тетя: "тети",
    дядя: "дяди",
    муж: "мужа",
    жена: "жены",
    коллега: "коллеги",
    друг: "друга",
    подруга: "подруги",
    мать: "матери",
    отец: "отца",
    сыночек: "сыночка",
    дочка: "дочки"
  };

  function declineKnownRelation(word) {
    if (!word) return null;
    var key = word.trim().toLowerCase();
    return RELATION_GENITIVE[key] || null;
  }

  function declineNamePartConfident(part) {
    if (!part) return null;

    // Фамилии на -ова/-ева/-ёва/-ина/-ына
    if (/[оеёОЕЁ]ва$/.test(part)) return part.slice(0, -1) + "ой";
    if (/[иыИЫ]на$/.test(part)) return part.slice(0, -1) + "ой";

    // Женские имена на -а / -я
    if (/а$/.test(part)) {
      if (/[гкх]а$/i.test(part)) return part.slice(0, -1) + "и";
      return part.slice(0, -1) + "ы";
    }

    if (/я$/.test(part)) return part.slice(0, -1) + "и";

    // Мужские имена на согласную: Денис → Дениса
    if (/[бвгджзклмнпрстфхцчшщ]$/i.test(part) && !/[АЕЁИОУЫЭЮЯаеёиоуыэюя]$/.test(part)) {
      return part + "а";
    }

    return null;
  }

  function declinePersonNameConfident(fullName) {
    var parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;

    var declined = [];
    for (var i = 0; i < parts.length; i += 1) {
      var next = declineNamePartConfident(parts[i]);
      if (!next) return null;
      declined.push(next);
    }

    return declined.join(" ");
  }

  function formatCongratulationTitle(item) {
    var name = typeof item.name === "string" ? item.name.trim() : "";
    var relation = typeof item.relation === "string" ? item.relation.trim() : "";
    var relationGen = declineKnownRelation(relation);
    var nameAsRelation = declineKnownRelation(name);
    var nameGen = name ? declinePersonNameConfident(name) : null;

    // мама / дочь как единственное поле имени
    if (!relation && nameAsRelation) {
      return "День рождения " + nameAsRelation;
    }

    // дочь + Александра, коллега + Татьяна Нефедова
    if (relationGen && nameGen) {
      return "День рождения " + relationGen + " " + nameGen;
    }

    if (relationGen && !name) {
      return "День рождения " + relationGen;
    }

    // Не искажаем неизвестные формы — безопасный формат
    if (name && relation) {
      return "День рождения: " + name + " · " + relation;
    }

    if (name) {
      return "День рождения: " + name;
    }

    if (relation) {
      return "День рождения: " + relation;
    }

    return "День рождения";
  }

  function isYearlyImportantDate(item) {
    if (!item) return false;
    if (item.yearly === true || item.yearly === "true" || item.yearly === 1) {
      return true;
    }

    var parts = parseDateParts(item.date);
    return Boolean(parts && parts.year < 1000);
  }

  function getCalendarEventsForYear(year) {
    if (window.MyDayHolidays && typeof window.MyDayHolidays.getCalendarEvents === "function") {
      return window.MyDayHolidays.getCalendarEvents(year) || [];
    }

    if (window.MyDayHolidaysRU && typeof window.MyDayHolidaysRU.getCalendarEvents === "function") {
      return window.MyDayHolidaysRU.getCalendarEvents(year) || [];
    }

    return [];
  }

  function collectPersonalMonthEvents(year, month) {
    var events = [];
    var birthday = getPersonalBirthdayParts();
    var birthdays = loadBirthdays();
    var importantDates = loadImportantDates();
    var i;

    if (birthday && birthday.month === month) {
      events.push({
        day: birthday.day,
        icon: "🎂",
        title: "Мой день рождения",
        dateKey: getDateParam(year, month, birthday.day),
        order: 0
      });
    }

    for (i = 0; i < birthdays.length; i += 1) {
      var congrats = birthdays[i];
      var congratsParts = parseDateParts(congrats && congrats.birthDate);
      if (!congratsParts || congratsParts.month !== month) continue;

      events.push({
        day: congratsParts.day,
        icon: "🎉",
        title: formatCongratulationTitle(congrats),
        dateKey: getDateParam(year, month, congratsParts.day),
        order: 1
      });
    }

    for (i = 0; i < importantDates.length; i += 1) {
      var important = importantDates[i];
      var importantParts = parseDateParts(important && important.date);
      if (!importantParts || importantParts.month !== month) continue;

      if (!isYearlyImportantDate(important) && importantParts.year !== year) {
        continue;
      }

      events.push({
        day: importantParts.day,
        icon: "💍",
        title: typeof important.title === "string" && important.title.trim()
          ? important.title.trim()
          : "—",
        dateKey: getDateParam(year, month, importantParts.day),
        order: 2
      });
    }

    events.sort(function (a, b) {
      if (a.day !== b.day) return a.day - b.day;
      if (a.order !== b.order) return a.order - b.order;
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      return 0;
    });

    return events;
  }

  function collectCalendarEvents(year, month) {
    var calendarEvents = getCalendarEventsForYear(year).filter(function (event) {
      return event && event.month === month;
    });

    calendarEvents.sort(function (a, b) {
      if (a.day !== b.day) return a.day - b.day;
      if (a.type < b.type) return -1;
      if (a.type > b.type) return 1;
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      return 0;
    });

    return calendarEvents;
  }

  function getCalendarEventIcon(type) {
    if (type === "official-holiday") return "🇷🇺";
    return "•";
  }

  function formatCalendarEventText(event, month) {
    var parts = [];

    // Церковные даты — только название, без календарной даты в подписи.
    if (event.type !== "religious-date" && typeof event.day === "number") {
      parts.push(formatMonthDay(event.day, month));
    }

    if (event.title) {
      parts.push(String(event.title).replace(/\bRU\b/g, "").trim());
    }

    if (event.subtitle) {
      parts.push(String(event.subtitle).replace(/\bRU\b/g, "").trim());
    }

    return parts.filter(Boolean).join(" · ");
  }

  function setMonthEventsVisibility(section, visible) {
    if (!section) return;

    if (visible) {
      section.hidden = false;
      section.removeAttribute("hidden");
      section.style.display = "block";
      return;
    }

    section.hidden = true;
    section.setAttribute("hidden", "");
    section.style.display = "none";
  }

  function renderPersonalMonthEvent(event, year, month) {
    var item = document.createElement("li");

    var button = document.createElement("button");
    button.className = "month-events__item";
    button.type = "button";
    button.addEventListener("click", function () {
      window.location.href =
        "day.html?date=" + event.dateKey +
        "&cal=" + getCalParam(year, month);
    });

    var dateLine = document.createElement("span");
    dateLine.className = "month-events__date";

    var icon = document.createElement("span");
    icon.className = "month-events__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = event.icon;

    var dateText = document.createElement("span");
    dateText.textContent = formatMonthDay(event.day, month);

    var name = document.createElement("span");
    name.className = "month-events__name";
    name.textContent = event.title;

    dateLine.appendChild(icon);
    dateLine.appendChild(dateText);
    button.appendChild(dateLine);
    button.appendChild(name);
    item.appendChild(button);

    return item;
  }

  function renderCalendarEvent(event, year, month) {
    var item = document.createElement("li");
    var dateKey = event.date || getDateParam(year, month, event.day);

    var button = document.createElement("button");
    button.className = "month-events__item month-events__item--calendar";
    button.type = "button";
    button.addEventListener("click", function () {
      window.location.href =
        "day.html?date=" + dateKey +
        "&cal=" + getCalParam(year, month);
    });

    var line = document.createElement("span");
    line.className = "month-events__line";

    var icon = document.createElement("span");
    icon.className = "month-events__icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = getCalendarEventIcon(event.type);

    var text = document.createElement("span");
    text.className = "month-events__text";
    text.textContent = formatCalendarEventText(event, month);

    line.appendChild(icon);
    line.appendChild(text);
    button.appendChild(line);
    item.appendChild(button);

    return item;
  }

  function renderMonthEvents(year, month) {
    var section = document.getElementById("month-events");
    var list = document.getElementById("month-events-list");
    if (!section || !list) return;

    var personalEvents = collectPersonalMonthEvents(year, month);

    // Единый массив всех календарных дат перед выводом.
    var calendarEvents = collectCalendarEvents(year, month);
    var i;

    list.innerHTML = "";

    if (!personalEvents.length && !calendarEvents.length) {
      setMonthEventsVisibility(section, false);
      return;
    }

    setMonthEventsVisibility(section, true);

    for (i = 0; i < personalEvents.length; i += 1) {
      list.appendChild(renderPersonalMonthEvent(personalEvents[i], year, month));
    }

    // Один цикл и один renderer для всех типов calendarEvents.
    for (i = 0; i < calendarEvents.length; i += 1) {
      list.appendChild(renderCalendarEvent(calendarEvents[i], year, month));
    }
  }

  function getCalendarEventMarkers(year) {
    var markers = {};
    var events = getCalendarEventsForYear(year);
    var i;

    for (i = 0; i < events.length; i += 1) {
      var event = events[i];
      if (!event || typeof event.month !== "number" || typeof event.day !== "number") {
        continue;
      }
      markers[event.month + "-" + event.day] = true;
    }

    return markers;
  }

  function hasCalendarEvent(markers, month, day) {
    return Boolean(markers && markers[month + "-" + day]);
  }

  function createDayButton(year, month, day, markers) {
    var button = document.createElement("button");
    var date = new Date(year, month, day);
    var weekday = date.getDay();
    var personalBirthday = isPersonalBirthday(markers.birthday, month, day);
    var congratulation = hasCongratulation(markers.congratulationDays, month, day);
    var importantDate = hasImportantDate(markers.importantDates, year, month, day);
    var calendarEvent = hasCalendarEvent(markers.calendarEvents, month, day);
    var hasInfo = personalBirthday || congratulation || importantDate || calendarEvent;

    button.className = "day";
    button.type = "button";
    button.textContent = String(day);
    button.setAttribute("aria-label", day + " " + MONTHS[month].toLowerCase());
    button.addEventListener("click", function () {
      window.location.href =
        "day.html?date=" + getDateParam(year, month, day) +
        "&cal=" + getCalParam(year, month);
    });

    if (weekday === 0 || weekday === 6) {
      button.classList.add("day--weekend");
    }

    if (isToday(year, month, day)) {
      button.classList.add("day--today");
      button.setAttribute("aria-current", "date");
    }

    if (hasInfo) {
      button.classList.add("day--info");
    }

    return button;
  }

  function renderCalendar() {
    var title = document.getElementById("calendar-title");
    var grid = document.getElementById("month-grid");
    if (!title || !grid) return;

    var year = visibleMonth.getFullYear();
    var month = visibleMonth.getMonth();
    var firstDay = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var leadingEmptyDays = getMondayBasedOffset(firstDay);
    var markers = {
      birthday: getPersonalBirthdayParts(),
      congratulationDays: getCongratulationDayKeys(),
      importantDates: getImportantDateMarkers(),
      calendarEvents: getCalendarEventMarkers(year)
    };

    title.textContent = MONTHS[month] + " " + year;
    grid.innerHTML = "";

    for (var i = 0; i < leadingEmptyDays; i += 1) {
      grid.appendChild(createEmptyDay());
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      grid.appendChild(createDayButton(year, month, day, markers));
    }

    renderMonthEvents(year, month);
    syncCalendarQuery();
  }

  function goToToday() {
    today = new Date();
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    renderCalendar();
  }

  function initMonthControls() {
    var prev = document.getElementById("prev-month");
    var next = document.getElementById("next-month");
    var todayBtn = document.getElementById("today-btn");

    if (prev) {
      prev.addEventListener("click", function () {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
        renderCalendar();
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
        renderCalendar();
      });
    }

    if (todayBtn) {
      todayBtn.addEventListener("click", goToToday);
    }
  }

  function initStatusbarTime() {
    var time = document.querySelector(".statusbar__time");
    if (!time) return;

    time.textContent = formatTime(new Date());

    window.setInterval(function () {
      time.textContent = formatTime(new Date());
    }, 60000);
  }

  function init() {
    renderCalendar();
    initMonthControls();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

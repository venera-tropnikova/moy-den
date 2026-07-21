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

  function formatMonthDayRange(startDay, endDay, month) {
    if (startDay === endDay) {
      return formatMonthDay(startDay, month);
    }

    return startDay + "–" + endDay + " " + MONTHS_GENITIVE[month];
  }

  function formatDateSpan(startDay, startMonth, endDay, endMonth) {
    if (startMonth === endMonth) {
      return formatMonthDayRange(startDay, endDay, startMonth);
    }

    return formatMonthDay(startDay, startMonth) + " – " + formatMonthDay(endDay, endMonth);
  }

  function eventIntersectsMonth(event, year, month) {
    if (!event) return false;

    if (event.isRange && typeof event.endDay === "number") {
      var start = new Date(event.year, event.month, event.day);
      var end = new Date(
        typeof event.endYear === "number" ? event.endYear : event.year,
        event.endMonth,
        event.endDay
      );
      var monthStart = new Date(year, month, 1);
      var monthEnd = new Date(year, month + 1, 0);
      return start <= monthEnd && end >= monthStart;
    }

    return event.month === month;
  }

  function getEventSortDay(event, year, month) {
    if (!event.isRange || typeof event.endDay !== "number") {
      return event.day;
    }

    if (event.month === month) {
      return event.day;
    }

    return 1;
  }

  function getEventIdentity(event) {
    return [
      event.title || "",
      event.subtitle || "",
      event.type || "",
      event.icon || ""
    ].join("\0");
  }

  function eventsAreIdentical(a, b) {
    return Boolean(a && b && getEventIdentity(a) === getEventIdentity(b));
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
      return eventIntersectsMonth(event, year, month);
    });

    calendarEvents.sort(function (a, b) {
      var dayA = getEventSortDay(a, year, month);
      var dayB = getEventSortDay(b, year, month);
      if (dayA !== dayB) return dayA - dayB;
      if (a.type < b.type) return -1;
      if (a.type > b.type) return 1;
      if (a.title < b.title) return -1;
      if (a.title > b.title) return 1;
      return 0;
    });

    return calendarEvents;
  }

  function formatEventTitle(event) {
    var parts = [];

    if (event.title) {
      parts.push(String(event.title).trim());
    }

    if (event.subtitle) {
      parts.push(String(event.subtitle).trim());
    }

    return parts.filter(Boolean).join(" · ");
  }

  function groupEventsByDay(events) {
    var groups = [];
    var indexByDay = {};
    var i;

    for (i = 0; i < events.length; i += 1) {
      var event = events[i];

      if (event.isRange && typeof event.endDay === "number") {
        groups.push({
          day: event.day,
          startDay: event.day,
          endDay: event.endDay,
          month: event.month,
          startMonth: event.month,
          endMonth: event.endMonth,
          isRange: true,
          dateKey: event.dateKey || event.date,
          events: [event]
        });
        continue;
      }

      var day = event.day;
      var group = indexByDay[day];

      if (!group) {
        group = {
          day: day,
          month: typeof event.month === "number" ? event.month : null,
          dateKey: event.dateKey || event.date,
          events: []
        };
        indexByDay[day] = group;
        groups.push(group);
      }

      group.events.push(event);
    }

    return groups;
  }

  function mergeConsecutiveIdenticalDayGroups(dayGroups) {
    var merged = [];
    var i;

    for (i = 0; i < dayGroups.length; i += 1) {
      var current = dayGroups[i];
      var prev = merged.length ? merged[merged.length - 1] : null;

      if (current.isRange) {
        merged.push({
          startDay: current.startDay,
          endDay: current.endDay,
          day: current.day,
          month: current.month,
          startMonth: current.startMonth,
          endMonth: current.endMonth,
          isRange: true,
          dateKey: current.dateKey,
          events: current.events.slice()
        });
        continue;
      }

      if (
        prev &&
        !prev.isRange &&
        prev.events.length === 1 &&
        current.events.length === 1 &&
        eventsAreIdentical(prev.events[0], current.events[0]) &&
        current.day === prev.endDay + 1
      ) {
        prev.endDay = current.day;
        continue;
      }

      merged.push({
        startDay: current.day,
        endDay: current.day,
        day: current.day,
        month: current.month,
        dateKey: current.dateKey,
        events: current.events.slice()
      });
    }

    return merged;
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

  function getEventListIcon(event, isPersonal) {
    if (isPersonal && event.icon) {
      return event.icon;
    }

    return "";
  }

  function renderMonthEventRow(event, year, month, isPersonal) {
    var item = document.createElement("li");
    var dateKey = event.dateKey || event.date || getDateParam(year, month, event.day);
    var listIcon = getEventListIcon(event, isPersonal);

    var button = document.createElement("button");
    button.className = "month-events__item" + (isPersonal ? "" : " month-events__item--calendar");
    button.type = "button";
    button.addEventListener("click", function () {
      window.location.href =
        "day.html?date=" + dateKey +
        "&cal=" + getCalParam(year, month);
    });

    var line = document.createElement("span");
    line.className = "month-events__line";

    if (listIcon) {
      var icon = document.createElement("span");
      icon.className = "month-events__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = listIcon;
      line.appendChild(icon);
    }

    var text = document.createElement("span");
    text.className = "month-events__text";
    text.textContent = formatEventTitle(event);
    line.appendChild(text);

    button.appendChild(line);
    item.appendChild(button);

    return item;
  }

  function renderMonthDayBlock(dayGroup, year, month, isPersonal) {
    var block = document.createElement("li");
    block.className = "month-events__day";

    var eventMonth = typeof dayGroup.month === "number" ? dayGroup.month : month;
    var startDay = typeof dayGroup.startDay === "number" ? dayGroup.startDay : dayGroup.day;
    var endDay = typeof dayGroup.endDay === "number" ? dayGroup.endDay : dayGroup.day;
    var startMonth =
      typeof dayGroup.startMonth === "number" ? dayGroup.startMonth : eventMonth;
    var endMonth =
      typeof dayGroup.endMonth === "number" ? dayGroup.endMonth : eventMonth;

    var dateLabel = document.createElement("p");
    dateLabel.className = "month-events__day-date";
    dateLabel.textContent = formatDateSpan(startDay, startMonth, endDay, endMonth);

    var list = document.createElement("ul");
    list.className = "month-events__day-list";
    list.setAttribute("role", "list");

    var i;
    for (i = 0; i < dayGroup.events.length; i += 1) {
      list.appendChild(
        renderMonthEventRow(dayGroup.events[i], year, month, isPersonal)
      );
    }

    block.appendChild(dateLabel);
    block.appendChild(list);

    return block;
  }

  function createMonthEventsGroup(title) {
    var group = document.createElement("div");
    group.className = "month-events__group";

    var heading = document.createElement("h3");
    heading.className = "month-events__group-title";
    heading.textContent = title;

    var list = document.createElement("ul");
    list.className = "month-events__list";
    list.setAttribute("role", "list");

    group.appendChild(heading);
    group.appendChild(list);

    return {
      root: group,
      list: list
    };
  }

  function fillMonthEventsGroup(groupList, events, year, month, isPersonal) {
    var dayGroups = mergeConsecutiveIdenticalDayGroups(groupEventsByDay(events));
    var i;

    for (i = 0; i < dayGroups.length; i += 1) {
      groupList.appendChild(
        renderMonthDayBlock(dayGroups[i], year, month, isPersonal)
      );
    }
  }

  function renderMonthEvents(year, month) {
    var section = document.getElementById("month-events");
    var body = document.getElementById("month-events-body");
    if (!section || !body) return;

    var personalEvents = collectPersonalMonthEvents(year, month);
    var calendarEvents = collectCalendarEvents(year, month);

    body.innerHTML = "";

    if (!personalEvents.length && !calendarEvents.length) {
      setMonthEventsVisibility(section, false);
      return;
    }

    setMonthEventsVisibility(section, true);

    if (personalEvents.length) {
      var personalGroup = createMonthEventsGroup("Важные даты");
      personalGroup.root.classList.add("month-events__group--personal");
      fillMonthEventsGroup(personalGroup.list, personalEvents, year, month, true);
      body.appendChild(personalGroup.root);
    }

    if (calendarEvents.length) {
      var calendarGroup = createMonthEventsGroup("Праздники и события");
      calendarGroup.root.classList.add("month-events__group--calendar");
      fillMonthEventsGroup(calendarGroup.list, calendarEvents, year, month, false);
      body.appendChild(calendarGroup.root);
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

      if (event.isRange && typeof event.endDay === "number") {
        var cursor = new Date(event.year, event.month, event.day);
        var end = new Date(
          typeof event.endYear === "number" ? event.endYear : event.year,
          event.endMonth,
          event.endDay
        );

        while (cursor <= end) {
          if (cursor.getFullYear() === year) {
            markers[cursor.getMonth() + "-" + cursor.getDate()] = true;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
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
    var hasPersonal = personalBirthday || congratulation || importantDate;
    var hasCalendar = calendarEvent;
    var hasInfo = hasPersonal || hasCalendar;

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

    if (hasPersonal) {
      button.classList.add("day--info-personal");
    }

    if (hasCalendar) {
      button.classList.add("day--info-calendar");
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

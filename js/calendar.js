(function () {
  "use strict";

  var USER_SETTINGS_KEY = "my-day-user-settings-v1";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var IMPORTANT_DATES_KEY = "my-day-important-dates-v1";

  var MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  var today = new Date();
  var visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  function getPersonalBirthdayParts() {
    try {
      var saved = localStorage.getItem(USER_SETTINGS_KEY);
      if (!saved) return null;

      var parsed = JSON.parse(saved);
      var birthDate = parsed && typeof parsed.birthDate === "string" ? parsed.birthDate : "";
      var match = birthDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
      if (!match) return null;

      return {
        month: Number(match[1]) - 1,
        day: Number(match[2])
      };
    } catch (error) {
      console.warn("Не удалось загрузить дату рождения:", error);
      return null;
    }
  }

  function isPersonalBirthday(birthday, month, day) {
    return Boolean(birthday && birthday.month === month && birthday.day === day);
  }

  function getCongratulationDayKeys() {
    var keys = {};

    try {
      var saved = localStorage.getItem(BIRTHDAYS_KEY);
      if (!saved) return keys;

      var parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return keys;

      parsed.forEach(function (item) {
        var birthDate = item && typeof item.birthDate === "string" ? item.birthDate : "";
        var match = birthDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
        if (!match) return;

        keys[Number(match[1]) - 1 + "-" + Number(match[2])] = true;
      });
    } catch (error) {
      console.warn("Не удалось загрузить поздравления:", error);
    }

    return keys;
  }

  function getImportantDateMarkers() {
    var markers = {
      yearly: {},
      once: {}
    };

    try {
      var saved = localStorage.getItem(IMPORTANT_DATES_KEY);
      if (!saved) return markers;

      var parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return markers;

      parsed.forEach(function (item) {
        if (!item || typeof item.date !== "string") return;

        var match = item.date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return;

        var month = Number(match[2]) - 1;
        var day = Number(match[3]);

        if (item.yearly) {
          markers.yearly[month + "-" + day] = true;
          return;
        }

        markers.once[item.date.trim()] = true;
      });
    } catch (error) {
      console.warn("Не удалось загрузить важные даты:", error);
    }

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

  function createDayButton(year, month, day, markers) {
    var button = document.createElement("button");
    var date = new Date(year, month, day);
    var weekday = date.getDay();
    var personalBirthday = isPersonalBirthday(markers.birthday, month, day);
    var congratulation = hasCongratulation(markers.congratulationDays, month, day);
    var importantDate = hasImportantDate(markers.importantDates, year, month, day);
    var hasInfo = personalBirthday || congratulation || importantDate;

    button.className = "day";
    button.type = "button";
    button.textContent = String(day);
    button.setAttribute("aria-label", day + " " + MONTHS[month].toLowerCase());
    button.addEventListener("click", function () {
      window.location.href = "day.html?date=" + getDateParam(year, month, day);
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
      importantDates: getImportantDateMarkers()
    };

    title.textContent = MONTHS[month] + " " + year;
    grid.innerHTML = "";

    for (var i = 0; i < leadingEmptyDays; i += 1) {
      grid.appendChild(createEmptyDay());
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      grid.appendChild(createDayButton(year, month, day, markers));
    }
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

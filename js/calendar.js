(function () {
  "use strict";

  var MONTHS = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];

  var today = new Date();
  var visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);

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

  function createDayButton(year, month, day) {
    var button = document.createElement("button");
    var date = new Date(year, month, day);
    var weekday = date.getDay();

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

    title.textContent = MONTHS[month] + " " + year;
    grid.innerHTML = "";

    for (var i = 0; i < leadingEmptyDays; i += 1) {
      grid.appendChild(createEmptyDay());
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      grid.appendChild(createDayButton(year, month, day));
    }
  }

  function initMonthControls() {
    var prev = document.getElementById("prev-month");
    var next = document.getElementById("next-month");

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

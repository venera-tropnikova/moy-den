(function (global) {
  "use strict";

  var TYPE_LABELS = {
    "official-holiday": "Государственный праздник",
    "commemorative-date": "Памятная дата",
    "popular-date": "Традиция дня",
    "religious-date": "Церковный праздник"
  };

  var PERMANENT_HOLIDAYS = [
    { month: 1, day: 1, title: "Новогодние каникулы" },
    { month: 1, day: 2, title: "Новогодние каникулы" },
    { month: 1, day: 3, title: "Новогодние каникулы" },
    { month: 1, day: 4, title: "Новогодние каникулы" },
    { month: 1, day: 5, title: "Новогодние каникулы" },
    { month: 1, day: 6, title: "Новогодние каникулы" },
    { month: 1, day: 7, title: "Рождество Христово" },
    { month: 1, day: 8, title: "Новогодние каникулы" },
    { month: 2, day: 23, title: "День защитника Отечества" },
    { month: 3, day: 8, title: "Международный женский день" },
    { month: 5, day: 1, title: "Праздник Весны и Труда" },
    { month: 5, day: 9, title: "День Победы" },
    { month: 6, day: 12, title: "День России" },
    { month: 11, day: 4, title: "День народного единства" }
  ];

  var COMMEMORATIVE_DATES = [
    {
      month: 1,
      day: 25,
      title: "День российского студенчества",
      subtitle: "Татьянин день"
    },
    { month: 4, day: 12, title: "День космонавтики" },
    {
      month: 8,
      day: 22,
      title: "День Государственного флага Российской Федерации"
    },
    { month: 9, day: 1, title: "День знаний" },
    { month: 10, day: 5, title: "День учителя" }
  ];

  var POPULAR_DATES = [
    { month: 1, day: 14, title: "Старый Новый год" },
    { month: 2, day: 14, title: "День святого Валентина" },
    { month: 4, day: 1, title: "День смеха" }
  ];

  var RELIGIOUS_DESCRIPTIONS = {
    "maslenitsa-start": "Начало масленичной недели перед Великим постом.",
    "palm-sunday": "Православный праздник Входа Господня в Иерусалим."
  };

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function buildDateKey(year, month, day) {
    return year + "-" + pad(month) + "-" + pad(day);
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[type] || "Календарная дата";
  }

  function getListIcon(type) {
    if (type === "official-holiday") return "🇷🇺";
    return "•";
  }

  function mapFixedItems(list, year, type) {
    var numericYear = Number(year);
    if (!numericYear) return [];

    return list.map(function (item) {
      var entry = {
        year: numericYear,
        date: buildDateKey(numericYear, item.month, item.day),
        title: item.title,
        type: type,
        typeLabel: getTypeLabel(type),
        icon: getListIcon(type),
        month: item.month - 1,
        day: item.day
      };

      if (item.subtitle) {
        entry.subtitle = item.subtitle;
      }

      return entry;
    });
  }

  function getOfficialHolidays(year) {
    return mapFixedItems(PERMANENT_HOLIDAYS, year, "official-holiday");
  }

  function getCommemorativeDates(year) {
    return mapFixedItems(COMMEMORATIVE_DATES, year, "commemorative-date");
  }

  function getPopularDates(year) {
    return mapFixedItems(POPULAR_DATES, year, "popular-date");
  }

  function getReligiousDates(year) {
    if (
      !global.MyDayOrthodoxEaster ||
      typeof global.MyDayOrthodoxEaster.getOrthodoxMovableDates !== "function"
    ) {
      return [];
    }

    var movable = global.MyDayOrthodoxEaster.getOrthodoxMovableDates(year) || [];

    return movable
      .map(function (item) {
        return {
          year: item.year,
          date: buildDateKey(item.year, item.month + 1, item.day),
          title: item.title,
          type: "religious-date",
          typeLabel: getTypeLabel("religious-date"),
          description: RELIGIOUS_DESCRIPTIONS[item.key] || "",
          icon: getListIcon("religious-date"),
          month: item.month,
          day: item.day,
          key: item.key
        };
      })
      .filter(function (item) {
        return item.year === Number(year);
      });
  }

  function getCalendarEvents(year) {
    return []
      .concat(getOfficialHolidays(year))
      .concat(getCommemorativeDates(year))
      .concat(getPopularDates(year))
      .concat(getReligiousDates(year));
  }

  function getCalendarEventsOnDate(year, month, day) {
    var dateKey = buildDateKey(year, month + 1, day);
    return getCalendarEvents(year).filter(function (item) {
      return item.date === dateKey;
    });
  }

  function getHolidayOnDate(year, month, day) {
    var dateKey = buildDateKey(year, month + 1, day);
    var list = getOfficialHolidays(year);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].date === dateKey) return list[i];
    }
    return null;
  }

  function getHolidayMarkers(year) {
    var markers = {};
    var list = getOfficialHolidays(year);
    for (var i = 0; i < list.length; i += 1) {
      markers[list[i].month + "-" + list[i].day] = list[i];
    }
    return markers;
  }

  function getFlag() {
    return "🇷🇺";
  }

  var ruProvider = {
    id: "ru",
    getOfficialHolidays: getOfficialHolidays,
    getCommemorativeDates: getCommemorativeDates,
    getPopularDates: getPopularDates,
    getReligiousDates: getReligiousDates,
    getCalendarEvents: getCalendarEvents,
    getCalendarEventsOnDate: getCalendarEventsOnDate,
    getHolidayOnDate: getHolidayOnDate,
    getHolidayMarkers: getHolidayMarkers,
    getFlag: getFlag
  };

  global.MyDayHolidaysRU = ruProvider;

  if (!global.MyDayHolidays) {
    global.MyDayHolidays = {
      providers: {},
      register: function (provider) {
        if (!provider || !provider.id) return;
        this.providers[provider.id] = provider;
        this.activeProviderId = provider.id;
      },
      callProvider: function (method, fallback, args) {
        var provider = this.providers[this.activeProviderId];
        if (!provider || typeof provider[method] !== "function") {
          return fallback;
        }
        return provider[method].apply(provider, args || []);
      }
    };
  }

  var api = global.MyDayHolidays;

  api.getOfficialHolidays = function (year) {
    return this.callProvider("getOfficialHolidays", [], [year]) || [];
  };

  api.getCalendarEvents = function (year) {
    return this.callProvider("getCalendarEvents", [], [year]) || [];
  };

  api.getCalendarEventsOnDate = function (year, month, day) {
    return this.callProvider("getCalendarEventsOnDate", [], [year, month, day]) || [];
  };

  api.getHolidayOnDate = function (year, month, day) {
    return this.callProvider("getHolidayOnDate", null, [year, month, day]) || null;
  };

  api.getHolidayMarkers = function (year) {
    return this.callProvider("getHolidayMarkers", {}, [year]) || {};
  };

  api.getFlag = function () {
    return this.callProvider("getFlag", "🇷🇺", []) || "🇷🇺";
  };

  global.MyDayHolidays.register(ruProvider);
})(window);

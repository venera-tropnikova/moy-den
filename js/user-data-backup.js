(function (window) {
  "use strict";

  var APP = "moy-den";
  var KIND = "user-data";
  var VERSION = 1;
  var SETTINGS_KEY = "my-day-user-settings-v1";
  var BIRTHDAYS_KEY = "my-day-birthdays-v1";
  var DATES_KEY = "my-day-important-dates-v1";
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  var GENDERS = ["", "female", "male"];
  var CATEGORIES = ["семья", "работа", "личное", "учёба", "путешествия", "другое"];
  var REMINDERS = ["", "in-day", "day-before", "week-before"];

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function isDateValue(value) {
    return value === "" || (typeof value === "string" && DATE_RE.test(value));
  }

  function fail(message) {
    return { ok: false, error: message, payload: null };
  }

  function validateSettings(settings) {
    if (!isPlainObject(settings)) {
      return "Профиль должен быть объектом";
    }
    if (typeof settings.name !== "string") return "Имя профиля должно быть строкой";
    if (typeof settings.city !== "string") return "Город должен быть строкой";
    if (typeof settings.birthDate !== "string" || !isDateValue(settings.birthDate)) {
      return "Дата рождения в профиле неверная";
    }
    if (GENDERS.indexOf(settings.gender) === -1) return "Пол в профиле неверный";
    return "";
  }

  function validateBirthday(item, index) {
    if (!isPlainObject(item)) return "День рождения №" + (index + 1) + " должен быть объектом";
    if (item.id === undefined || item.id === null || (typeof item.id !== "string" && typeof item.id !== "number")) {
      return "У дня рождения №" + (index + 1) + " нет id";
    }
    if (typeof item.name !== "string") return "Имя в дне рождения №" + (index + 1) + " должно быть строкой";
    if (typeof item.relation !== "string") return "Родство в дне рождения №" + (index + 1) + " должно быть строкой";
    if (typeof item.birthDate !== "string" || !isDateValue(item.birthDate)) {
      return "Дата в дне рождения №" + (index + 1) + " неверная";
    }
    return "";
  }

  function validateImportantDate(item, index) {
    if (!isPlainObject(item)) return "Важная дата №" + (index + 1) + " должна быть объектом";
    if (item.id === undefined || item.id === null || (typeof item.id !== "string" && typeof item.id !== "number")) {
      return "У важной даты №" + (index + 1) + " нет id";
    }
    if (typeof item.title !== "string") return "Название важной даты №" + (index + 1) + " должно быть строкой";
    if (typeof item.yearly !== "boolean") return "Поле yearly важной даты №" + (index + 1) + " должно быть да/нет";
    if (typeof item.date !== "string" || !isDateValue(item.date)) {
      return "Дата важной даты №" + (index + 1) + " неверная";
    }
    if (CATEGORIES.indexOf(item.category) === -1) return "Категория важной даты №" + (index + 1) + " неверная";
    if (REMINDERS.indexOf(item.reminder) === -1) return "Напоминание важной даты №" + (index + 1) + " неверное";
    return "";
  }

  function pickSettings(settings) {
    return {
      name: settings.name,
      city: settings.city,
      birthDate: settings.birthDate,
      gender: settings.gender
    };
  }

  function pickBirthday(item) {
    return {
      id: item.id,
      name: item.name,
      relation: item.relation,
      birthDate: item.birthDate
    };
  }

  function pickImportantDate(item) {
    return {
      id: item.id,
      title: item.title,
      yearly: item.yearly,
      date: item.date,
      category: item.category,
      reminder: item.reminder
    };
  }

  function buildExport(settings, birthdays, importantDates) {
    return {
      app: APP,
      kind: KIND,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        "my-day-user-settings-v1": pickSettings(settings),
        "my-day-birthdays-v1": birthdays.map(pickBirthday),
        "my-day-important-dates-v1": importantDates.map(pickImportantDate)
      }
    };
  }

  function parseAndValidate(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return fail("Файл не является JSON");
    }

    if (!isPlainObject(parsed)) return fail("Файл должен содержать объект");
    if (parsed.app !== APP) return fail("Это не файл данных «Мой день»");
    if (parsed.kind !== KIND) return fail("Это не файл переноса данных");
    if (parsed.version !== VERSION) return fail("Неподдерживаемая версия файла");
    if (!isPlainObject(parsed.data)) return fail("В файле нет блока data");

    if (!Object.prototype.hasOwnProperty.call(parsed.data, SETTINGS_KEY)) {
      return fail("В файле нет профиля");
    }
    if (!Object.prototype.hasOwnProperty.call(parsed.data, BIRTHDAYS_KEY)) {
      return fail("В файле нет дней рождения");
    }
    if (!Object.prototype.hasOwnProperty.call(parsed.data, DATES_KEY)) {
      return fail("В файле нет важных дат");
    }

    var settings = parsed.data[SETTINGS_KEY];
    var settingsError = validateSettings(settings);
    if (settingsError) return fail(settingsError);

    var birthdays = parsed.data[BIRTHDAYS_KEY];
    if (!Array.isArray(birthdays)) return fail("Дни рождения должны быть списком");
    var i;
    for (i = 0; i < birthdays.length; i += 1) {
      var birthdayError = validateBirthday(birthdays[i], i);
      if (birthdayError) return fail(birthdayError);
    }

    var dates = parsed.data[DATES_KEY];
    if (!Array.isArray(dates)) return fail("Важные даты должны быть списком");
    for (i = 0; i < dates.length; i += 1) {
      var dateError = validateImportantDate(dates[i], i);
      if (dateError) return fail(dateError);
    }

    return {
      ok: true,
      error: "",
      payload: {
        settings: pickSettings(settings),
        birthdays: birthdays.map(pickBirthday),
        importantDates: dates.map(pickImportantDate)
      }
    };
  }

  window.MyDayUserDataBackup = {
    FILE_NAME: "moy-den-user-data.json",
    buildExport: buildExport,
    parseAndValidate: parseAndValidate
  };
})(window);

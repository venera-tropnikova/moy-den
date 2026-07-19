(function (window) {
  "use strict";

  var STORAGE_KEY = "my-day-birthdays-v1";

  function normalizeBirthday(birthday) {
    return {
      id: birthday.id,
      name: typeof birthday.name === "string" ? birthday.name : "",
      relation: typeof birthday.relation === "string" ? birthday.relation : "",
      birthDate: typeof birthday.birthDate === "string" ? birthday.birthDate : ""
    };
  }

  function loadBirthdays() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];

      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map(normalizeBirthday) : [];
    } catch (error) {
      console.warn("Не удалось загрузить дни рождения:", error);
      return [];
    }
  }

  function saveBirthdays(birthdays) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(birthdays.map(normalizeBirthday)));
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить дни рождения:", error);
      return false;
    }
  }

  function addBirthday(birthday) {
    var birthdays = loadBirthdays();
    var nextBirthday = normalizeBirthday({
      id: birthday.id || Date.now(),
      name: birthday.name,
      relation: birthday.relation,
      birthDate: birthday.birthDate
    });

    birthdays.push(nextBirthday);
    saveBirthdays(birthdays);
    return nextBirthday;
  }

  function deleteBirthday(id) {
    var birthdays = loadBirthdays();
    var nextBirthdays = birthdays.filter(function (birthday) {
      return String(birthday.id) !== String(id);
    });

    return saveBirthdays(nextBirthdays);
  }

  window.MyDayBirthdaysStorage = {
    loadBirthdays: loadBirthdays,
    saveBirthdays: saveBirthdays,
    addBirthday: addBirthday,
    deleteBirthday: deleteBirthday
  };
})(window);

(function () {
  "use strict";

  var STORAGE_KEY = "my-day-user-settings-v1";

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function getDefaultSettings() {
    return {
      name: "",
      city: "",
      birthDate: "",
      gender: ""
    };
  }

  function normalizeSettings(settings) {
    return {
      name: typeof settings.name === "string" ? settings.name : "",
      city: typeof settings.city === "string" ? settings.city : "",
      birthDate: typeof settings.birthDate === "string" ? settings.birthDate : "",
      gender: typeof settings.gender === "string" ? settings.gender : ""
    };
  }

  function loadSettings() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return getDefaultSettings();

      var parsed = JSON.parse(saved);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return getDefaultSettings();
      }

      return normalizeSettings(parsed);
    } catch (error) {
      console.warn("Не удалось загрузить профиль:", error);
      return getDefaultSettings();
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить профиль:", error);
      return false;
    }
  }

  function getGenderLabel(value) {
    if (value === "female") return "Женский";
    if (value === "male") return "Мужской";
    return "—";
  }

  function getDisplayValue(value) {
    return value ? value : "—";
  }

  function renderSummary(settings) {
    var name = document.getElementById("summary-name");
    var city = document.getElementById("summary-city");
    var birthDate = document.getElementById("summary-birth-date");
    var gender = document.getElementById("summary-gender");

    if (name) name.textContent = getDisplayValue(settings.name);
    if (city) city.textContent = getDisplayValue(settings.city);
    if (birthDate) birthDate.textContent = getDisplayValue(settings.birthDate);
    if (gender) gender.textContent = getGenderLabel(settings.gender);
  }

  function fillForm(settings) {
    var name = document.getElementById("profile-name");
    var city = document.getElementById("profile-city");
    var birthDate = document.getElementById("profile-birth-date");
    var gender = document.getElementById("profile-gender");

    if (name) name.value = settings.name;
    if (city) city.value = settings.city;
    if (birthDate) birthDate.value = settings.birthDate;
    if (gender) gender.value = settings.gender;
  }

  function readForm() {
    var name = document.getElementById("profile-name");
    var city = document.getElementById("profile-city");
    var birthDate = document.getElementById("profile-birth-date");
    var gender = document.getElementById("profile-gender");

    return normalizeSettings({
      name: name ? name.value.trim() : "",
      city: city ? city.value.trim() : "",
      birthDate: birthDate ? birthDate.value : "",
      gender: gender ? gender.value : ""
    });
  }

  function initForm() {
    var form = document.getElementById("profile-form");
    var status = document.getElementById("profile-status");
    if (!form) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var settings = readForm();
      if (saveSettings(settings)) {
        renderSummary(settings);
        if (status) status.textContent = "Данные сохранены.";
      } else if (status) {
        status.textContent = "Не удалось сохранить данные.";
      }
    });
  }

  function initStatusbarTime() {
    var time = document.getElementById("statusbar-time");
    if (!time) return;

    time.textContent = formatTime(new Date());

    window.setInterval(function () {
      time.textContent = formatTime(new Date());
    }, 60000);
  }

  function init() {
    var settings = loadSettings();
    fillForm(settings);
    renderSummary(settings);
    initForm();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

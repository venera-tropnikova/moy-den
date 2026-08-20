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

  var statusTimer = null;

  function showStatus(message) {
    var status = document.getElementById("profile-status");
    if (!status) return;

    status.textContent = message;

    if (statusTimer) {
      window.clearTimeout(statusTimer);
      statusTimer = null;
    }

    if (!message) return;

    statusTimer = window.setTimeout(function () {
      status.textContent = "";
      statusTimer = null;
    }, 2500);
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
    if (!form) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var settings = readForm();
      if (saveSettings(settings)) {
        showStatus("Данные сохранены");
      } else {
        showStatus("Не удалось сохранить данные");
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
    initForm();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

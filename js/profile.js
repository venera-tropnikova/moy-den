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

  function initScenePicker() {
    var picker = document.getElementById("scene-picker");
    if (!picker || !window.MyDaySceneBackground) return;
    window.MyDaySceneBackground.applyToScreen(document.querySelector(".screen"));
    window.MyDaySceneBackground.renderPicker(picker);
  }

  function initStatusbarTime() {
    var time = document.getElementById("statusbar-time");
    if (!time) return;

    time.textContent = formatTime(new Date());

    window.setInterval(function () {
      time.textContent = formatTime(new Date());
    }, 60000);
  }

  function focusCityFromHash() {
    if (window.location.hash !== "#profile-city") return;
    var city = document.getElementById("profile-city");
    if (!city) return;
    city.focus();
    if (city.scrollIntoView) city.scrollIntoView({ block: "nearest" });
  }

  function showBackupStatus(message) {
    var status = document.getElementById("profile-backup-status");
    if (!status) return;
    status.textContent = message || "";
  }

  function downloadBackup(payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = window.MyDayUserDataBackup.FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function applyImportedData(payload) {
    var birthdaysStorage = window.MyDayBirthdaysStorage;
    var datesStorage = window.MyDayImportantDatesStorage;
    if (!birthdaysStorage || !datesStorage) return false;

    if (!saveSettings(payload.settings)) return false;
    if (!birthdaysStorage.saveBirthdays(payload.birthdays)) return false;
    if (!datesStorage.saveImportantDates(payload.importantDates)) return false;

    fillForm(loadSettings());
    showBackupStatus(
      "Данные восстановлены: дни рождения — " +
        payload.birthdays.length +
        ", важные даты — " +
        payload.importantDates.length
    );
    return true;
  }

  function initBackup() {
    var backup = window.MyDayUserDataBackup;
    var exportBtn = document.getElementById("profile-export-btn");
    var importBtn = document.getElementById("profile-import-btn");
    var fileInput = document.getElementById("profile-import-file");
    if (!backup || !exportBtn || !importBtn || !fileInput) return;

    exportBtn.addEventListener("click", function () {
      var birthdaysStorage = window.MyDayBirthdaysStorage;
      var datesStorage = window.MyDayImportantDatesStorage;
      if (!birthdaysStorage || !datesStorage) {
        showBackupStatus("Не удалось подготовить экспорт");
        return;
      }

      var payload = backup.buildExport(
        loadSettings(),
        birthdaysStorage.loadBirthdays(),
        datesStorage.loadImportantDates()
      );
      downloadBackup(payload);
      showBackupStatus("Файл данных скачан");
    });

    importBtn.addEventListener("click", function () {
      fileInput.value = "";
      fileInput.click();
    });

    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function () {
        var result = backup.parseAndValidate(String(reader.result || ""));
        if (!result.ok) {
          showBackupStatus(result.error || "Не удалось прочитать файл");
          return;
        }
        if (!applyImportedData(result.payload)) {
          showBackupStatus("Не удалось сохранить импортированные данные");
        }
      };
      reader.onerror = function () {
        showBackupStatus("Не удалось прочитать файл");
      };
      reader.readAsText(file);
    });
  }

  window.MyDayProfileSettings = {
    loadSettings: loadSettings,
    saveSettings: saveSettings
  };

  function init() {
    var settings = loadSettings();
    fillForm(settings);
    focusCityFromHash();
    initForm();
    initBackup();
    initScenePicker();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

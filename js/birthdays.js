(function () {
  "use strict";

  function formatTime(date) {
    var h = String(date.getHours()).padStart(2, "0");
    var m = String(date.getMinutes()).padStart(2, "0");
    return h + ":" + m;
  }

  function getStorage() {
    return window.MyDayBirthdaysStorage;
  }

  function getDisplayValue(value) {
    return value ? value : "—";
  }

  function renderBirthdays() {
    var storage = getStorage();
    var list = document.getElementById("birthdays-list");
    var empty = document.getElementById("birthdays-empty");
    if (!storage || !list || !empty) return;

    var birthdays = storage.loadBirthdays();
    list.innerHTML = "";
    empty.hidden = birthdays.length > 0;

    birthdays.forEach(function (birthday) {
      var item = document.createElement("li");
      item.className = "birthday-item";

      var body = document.createElement("div");

      var name = document.createElement("p");
      name.className = "birthday-item__name";
      name.textContent = getDisplayValue(birthday.name);

      var meta = document.createElement("p");
      meta.className = "birthday-item__meta";
      meta.textContent = getDisplayValue(birthday.relation) + " · " + getDisplayValue(birthday.birthDate);

      var deleteButton = document.createElement("button");
      deleteButton.className = "birthday-delete-btn";
      deleteButton.type = "button";
      deleteButton.textContent = "Удалить";
      deleteButton.addEventListener("click", function () {
        storage.deleteBirthday(birthday.id);
        renderBirthdays();
      });

      body.appendChild(name);
      body.appendChild(meta);
      item.appendChild(body);
      item.appendChild(deleteButton);
      list.appendChild(item);
    });
  }

  function initForm() {
    var storage = getStorage();
    var form = document.getElementById("birthday-form");
    var status = document.getElementById("birthday-status");
    var name = document.getElementById("birthday-name");
    var relation = document.getElementById("birthday-relation");
    var birthDate = document.getElementById("birthday-date");

    if (!storage || !form || !name || !relation || !birthDate) return;

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var nextName = name.value.trim();
      var nextRelation = relation.value.trim();
      var nextBirthDate = birthDate.value;

      if (!nextName || !nextBirthDate) {
        if (status) status.textContent = "Заполните имя и дату рождения.";
        return;
      }

      storage.addBirthday({
        name: nextName,
        relation: nextRelation,
        birthDate: nextBirthDate
      });

      form.reset();
      if (status) status.textContent = "День рождения сохранён.";
      renderBirthdays();
      name.focus();
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
    renderBirthdays();
    initForm();
    initStatusbarTime();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

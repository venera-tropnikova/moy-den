(function (window) {
  "use strict";

  var STORAGE_KEY = "my-day-important-dates-v1";

  var CATEGORIES = ["семья", "работа", "личное", "учёба", "путешествия", "другое"];
  var REMINDERS = ["", "in-day", "day-before", "week-before"];

  function normalizeImportantDate(item) {
    var category = typeof item.category === "string" ? item.category : "";
    var reminder = typeof item.reminder === "string" ? item.reminder : "";

    return {
      id: item.id,
      title: typeof item.title === "string" ? item.title : "",
      yearly: Boolean(item.yearly),
      date: typeof item.date === "string" ? item.date : "",
      category: CATEGORIES.indexOf(category) === -1 ? "другое" : category,
      reminder: REMINDERS.indexOf(reminder) === -1 ? "" : reminder
    };
  }

  function loadImportantDates() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];

      var parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.map(normalizeImportantDate) : [];
    } catch (error) {
      console.warn("Не удалось загрузить важные даты:", error);
      return [];
    }
  }

  function saveImportantDates(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(normalizeImportantDate)));
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить важные даты:", error);
      return false;
    }
  }

  function addImportantDate(item) {
    var items = loadImportantDates();
    var nextItem = normalizeImportantDate({
      id: item.id || Date.now(),
      title: item.title,
      yearly: item.yearly,
      date: item.date,
      category: item.category,
      reminder: item.reminder
    });

    items.push(nextItem);
    saveImportantDates(items);
    return nextItem;
  }

  function updateImportantDate(id, item) {
    var items = loadImportantDates();
    var index = -1;

    for (var i = 0; i < items.length; i += 1) {
      if (String(items[i].id) === String(id)) {
        index = i;
        break;
      }
    }

    if (index === -1) return false;

    items[index] = normalizeImportantDate({
      id: items[index].id,
      title: item.title,
      yearly: item.yearly,
      date: item.date,
      category: item.category,
      reminder: item.reminder
    });

    return saveImportantDates(items);
  }

  function deleteImportantDate(id) {
    var items = loadImportantDates();
    var nextItems = items.filter(function (item) {
      return String(item.id) !== String(id);
    });

    return saveImportantDates(nextItems);
  }

  window.MyDayImportantDatesStorage = {
    loadImportantDates: loadImportantDates,
    saveImportantDates: saveImportantDates,
    addImportantDate: addImportantDate,
    updateImportantDate: updateImportantDate,
    deleteImportantDate: deleteImportantDate
  };
})(window);

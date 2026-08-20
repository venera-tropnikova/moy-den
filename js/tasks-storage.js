(function (window) {
  "use strict";

  var STORAGE_KEY = "my-day-date-tasks-v1";

  function normalizeTask(task) {
    return {
      id: task.id,
      text: task.text,
      done: Boolean(task.done)
    };
  }

  function getDateKey(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function loadTasksByDate() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return {};

      var parsed = JSON.parse(saved);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      console.warn("Не удалось загрузить задачи:", error);
      return {};
    }
  }

  function saveTasksByDate(tasksByDate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasksByDate));
    } catch (error) {
      console.warn("Не удалось сохранить задачи:", error);
    }
  }

  function getTasksForDate(dateKey) {
    var tasks = loadTasksByDate()[dateKey];
    if (!Array.isArray(tasks)) return [];

    return tasks.map(normalizeTask);
  }

  function saveTasksForDate(dateKey, tasks) {
    var tasksByDate = loadTasksByDate();
    tasksByDate[dateKey] = tasks.map(normalizeTask);
    saveTasksByDate(tasksByDate);
  }

  function addTaskForDate(dateKey, text) {
    var tasks = getTasksForDate(dateKey);
    var task = {
      id: Date.now(),
      text: text,
      done: false
    };

    tasks.push(task);
    saveTasksForDate(dateKey, tasks);
    return task;
  }

  function updateTaskForDate(dateKey, taskId, patch) {
    var tasks = getTasksForDate(dateKey);
    var currentTask = tasks.find(function (task) {
      return String(task.id) === String(taskId);
    });

    if (!currentTask) return false;

    if (Object.prototype.hasOwnProperty.call(patch, "text")) {
      currentTask.text = patch.text;
    }

    if (Object.prototype.hasOwnProperty.call(patch, "done")) {
      currentTask.done = Boolean(patch.done);
    }

    saveTasksForDate(dateKey, tasks);
    return true;
  }

  window.MyDayTasksStorage = {
    getDateKey: getDateKey,
    getTasksForDate: getTasksForDate,
    saveTasksForDate: saveTasksForDate,
    addTaskForDate: addTaskForDate,
    updateTaskForDate: updateTaskForDate
  };
})(window);

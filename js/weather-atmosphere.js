(function (window) {
  "use strict";

  var WEATHER_EVENT = "myday:weather-state";
  var RAIN_SCENE = "rain";

  function isToday(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) return false;

    var today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  }

  function canApplyCurrentWeather() {
    if (!document.querySelector(".day-screen")) return true;
    return isToday(window.MyDayTargetDate);
  }

  function setScene(scene) {
    var screen = document.querySelector(".screen");
    var themeColor = document.querySelector('meta[name="theme-color"]');
    if (!screen) return;

    if (scene === RAIN_SCENE) {
      screen.setAttribute("data-weather-scene", RAIN_SCENE);
      if (themeColor) themeColor.setAttribute("content", "#DCE5E5");
      return;
    }

    screen.removeAttribute("data-weather-scene");
    if (themeColor) themeColor.setAttribute("content", "#ECE6DD");
  }

  function applyWeatherState(state) {
    var scene = state && state.status === "ok" && state.condition === "rain" &&
      canApplyCurrentWeather()
      ? RAIN_SCENE
      : null;

    setScene(scene);
  }

  document.addEventListener(WEATHER_EVENT, function (event) {
    applyWeatherState(event.detail);
  });

  window.MyDayWeatherAtmosphere = {
    applyWeatherState: applyWeatherState
  };
})(window);
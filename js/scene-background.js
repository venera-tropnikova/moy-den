(function (global) {
  "use strict";

  var CATALOG_URL = "assets/scenes/scenes.json?v=20260823-6";
  var STORAGE_KEY = "my-day-background-scene-v1";
  var DEFAULT_SCENE_ID = "daisy-morning";
  var AUTO_ID = "__auto__";
  var AUTO_SCENE_IDS = {
    "winter-lake-evening": true,
    "autumn-flowers-day": true,
    "autumn-rain-window": true,
    "winter-mountain-lake": true,
    "spring-butterfly": true,
    "summer-turquoise-lake": true,
    "auto-fog": true,
    "auto-rain": true
  };

  var FALLBACK_MANUAL = [
    {
      id: "daisy-morning",
      title: "Ромашковое утро",
      image: "assets/scenes/daisy-morning.jpg",
      season: ["spring", "summer"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["morning", "day"]
    },
    {
      id: "forest-after-rain",
      title: "Лес после дождя",
      image: "assets/scenes/forest-after-rain.jpg",
      season: ["spring", "summer", "autumn"],
      weather: ["rain"],
      daypart: ["morning", "day"]
    },
    {
      id: "mountain-morning",
      title: "Горное утро",
      image: "assets/scenes/mountain-morning.jpg",
      season: ["spring", "summer", "autumn"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["morning"]
    },
    {
      id: "sea-breeze",
      title: "Морской бриз",
      image: "assets/scenes/sea-breeze.jpg",
      season: ["summer"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["day"]
    }
  ];

  var catalogCache = null;
  var lastWeatherCondition = null;
  var autoRefreshBound = false;

  function loadCatalogSync() {
    if (catalogCache) return catalogCache;

    try {
      var request = new XMLHttpRequest();
      request.open("GET", CATALOG_URL, false);
      request.send(null);

      if (
        (request.status >= 200 && request.status < 300 || request.status === 0) &&
        request.responseText
      ) {
        var parsed = JSON.parse(request.responseText);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.manualScenes)) {
          catalogCache = {
            storageKey: typeof parsed.storageKey === "string" ? parsed.storageKey : STORAGE_KEY,
            defaultSceneId:
              typeof parsed.defaultSceneId === "string" ? parsed.defaultSceneId : DEFAULT_SCENE_ID,
            manualScenes: parsed.manualScenes.filter(isUsableScene),
            weatherScenes: Array.isArray(parsed.weatherScenes) ? parsed.weatherScenes : []
          };
          if (catalogCache.manualScenes.length) return catalogCache;
        }
      }
    } catch (error) {
      console.warn("Не удалось загрузить каталог фонов:", error);
    }

    catalogCache = {
      storageKey: STORAGE_KEY,
      defaultSceneId: DEFAULT_SCENE_ID,
      manualScenes: FALLBACK_MANUAL.slice(),
      weatherScenes: []
    };
    return catalogCache;
  }

  function isUsableScene(scene) {
    return (
      scene &&
      typeof scene === "object" &&
      typeof scene.id === "string" &&
      scene.id.trim() &&
      typeof scene.title === "string" &&
      scene.title.trim() &&
      typeof scene.image === "string" &&
      scene.image.trim()
    );
  }

  function getManualScenes() {
    return loadCatalogSync().manualScenes.slice();
  }

  function getWeatherScenes() {
    return loadCatalogSync().weatherScenes.slice();
  }

  function findManualScene(sceneId) {
    var list = getManualScenes();
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === sceneId) return list[i];
    }
    return null;
  }

  function tagList(scene, key) {
    var raw = scene && scene[key];
    if (!Array.isArray(raw)) return [];
    var result = [];
    for (var i = 0; i < raw.length; i += 1) {
      if (typeof raw[i] === "string" && raw[i].trim()) result.push(raw[i].trim());
    }
    return result;
  }

  function hasTag(scene, key, value) {
    return tagList(scene, key).indexOf(value) !== -1;
  }

  function isOnlySeason(scene, season) {
    var seasons = tagList(scene, "season");
    if (!seasons.length) return false;
    for (var i = 0; i < seasons.length; i += 1) {
      if (seasons[i] !== season) return false;
    }
    return true;
  }

  function getSeason(date) {
    var month = date.getMonth();
    if (month >= 2 && month <= 4) return "spring";
    if (month >= 5 && month <= 7) return "summer";
    if (month >= 8 && month <= 10) return "autumn";
    return "winter";
  }

  function getTimeOfDay(date) {
    var hour = date.getHours();
    if (hour < 5) return "night";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 22) return "evening";
    return "night";
  }

  function normalizeWeather(condition) {
    if (condition === "thunderstorm") return "rain";
    if (
      condition === "clear" ||
      condition === "partly_cloudy" ||
      condition === "cloudy" ||
      condition === "rain" ||
      condition === "snow" ||
      condition === "fog"
    ) {
      return condition;
    }
    return null;
  }

  function normalizeDaypart(daypart) {
    if (daypart === "afternoon") return "day";
    if (daypart === "night" || daypart === "morning" || daypart === "day" || daypart === "evening") {
      return daypart;
    }
    return null;
  }

  function normalizeContext(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var date = source.date instanceof Date && !isNaN(source.date.getTime())
      ? source.date
      : (window.MyDayTargetDate instanceof Date ? window.MyDayTargetDate : new Date());
    return {
      weather: Object.prototype.hasOwnProperty.call(source, "weather")
        ? normalizeWeather(source.weather)
        : lastWeatherCondition,
      season: typeof source.season === "string" && source.season
        ? source.season
        : getSeason(date),
      daypart: Object.prototype.hasOwnProperty.call(source, "daypart")
        ? normalizeDaypart(source.daypart)
        : normalizeDaypart(getTimeOfDay(date))
    };
  }

  function isAlwaysBanned(scene, ctx) {
    if (hasTag(scene, "weather", "rain") && ctx.weather !== "rain") return true;
    if (hasTag(scene, "weather", "fog") && ctx.weather !== "fog") return true;
    if (hasTag(scene, "weather", "snow") && ctx.weather !== "snow") {
      if (!ctx.weather || !hasTag(scene, "weather", ctx.weather)) return true;
    }
    if (isOnlySeason(scene, "winter") && ctx.season === "summer") return true;
    if (isOnlySeason(scene, "summer") && ctx.season === "winter") return true;
    return false;
  }

  function matchesDaypart(scene, ctx, requiredDaypart) {
    var needed = requiredDaypart || ctx.daypart;
    if (!needed) return false;
    return hasTag(scene, "daypart", needed);
  }

  function scoreScene(scene, ctx, options) {
    var score = 0;
    if (ctx.weather && hasTag(scene, "weather", ctx.weather)) {
      score += 100;
      if (tagList(scene, "weather").length === 1) score += 5;
    }
    if (options.requireDaypart) {
      if (matchesDaypart(scene, ctx, options.daypartAlias)) score += 40;
    } else if (ctx.daypart === "night") {
      if (hasTag(scene, "daypart", "evening")) score += 40;
      else if (hasTag(scene, "daypart", "day")) score += 20;
    } else if (matchesDaypart(scene, ctx)) {
      score += 40;
    }
    if (hasTag(scene, "season", ctx.season)) score += 20;
    return score;
  }

  function isAutoAllowed(scene) {
    return !!(scene && AUTO_SCENE_IDS[scene.id]);
  }

  function isCandidate(scene, ctx, options) {
    if (!isAutoAllowed(scene)) return false;
    if (isAlwaysBanned(scene, ctx)) return false;
    if (options.requireWeather) {
      if (!ctx.weather || !hasTag(scene, "weather", ctx.weather)) return false;
    }
    if (options.requireSeason && !hasTag(scene, "season", ctx.season)) return false;
    if (options.requireDaypart && !matchesDaypart(scene, ctx, options.daypartAlias)) return false;
    return true;
  }

  function pickBest(ctx, options) {
    var scenes = getManualScenes();
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < scenes.length; i += 1) {
      var scene = scenes[i];
      if (!isCandidate(scene, ctx, options)) continue;
      var score = scoreScene(scene, ctx, options);
      if (score > bestScore) {
        best = scene;
        bestScore = score;
      }
    }
    return best;
  }

  function resolveAutoScene(rawContext) {
    var ctx = normalizeContext(rawContext);
    var found = null;

    var requireWeather = !!ctx.weather;

    found = pickBest(ctx, {
      requireWeather: requireWeather,
      requireDaypart: true,
      requireSeason: true
    });
    if (found) return found;

    if (ctx.daypart === "night") {
      found = pickBest(ctx, {
        requireWeather: requireWeather,
        requireDaypart: true,
        requireSeason: true,
        daypartAlias: "evening"
      });
      if (found) return found;
      found = pickBest(ctx, {
        requireWeather: requireWeather,
        requireDaypart: true,
        requireSeason: true,
        daypartAlias: "day"
      });
      if (found) return found;
    }

    return null;
  }

  function readSelection() {
    var catalog = loadCatalogSync();
    try {
      var raw = localStorage.getItem(catalog.storageKey || STORAGE_KEY);
      if (!raw) return { mode: "auto", sceneId: null };

      var parsed = JSON.parse(raw);
      if (typeof parsed === "string") {
        return findManualScene(parsed)
          ? { mode: "manual", sceneId: parsed }
          : { mode: "auto", sceneId: null };
      }
      if (!parsed || typeof parsed !== "object") return { mode: "auto", sceneId: null };

      if (parsed.mode === "auto") return { mode: "auto", sceneId: null };

      var id = typeof parsed.sceneId === "string" ? parsed.sceneId : "";
      if (id && findManualScene(id)) return { mode: "manual", sceneId: id };
    } catch (error) {
      console.warn("Не удалось прочитать выбранный фон:", error);
    }

    return { mode: "auto", sceneId: null };
  }

  function writeSelection(payload) {
    var catalog = loadCatalogSync();
    try {
      localStorage.setItem(
        catalog.storageKey || STORAGE_KEY,
        JSON.stringify({
          mode: payload.mode,
          sceneId: payload.sceneId || undefined,
          updatedAt: new Date().toISOString()
        })
      );
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить фон:", error);
      return false;
    }
  }

  function getSelectedSceneId(rawContext) {
    var selection = readSelection();
    if (selection.mode === "manual" && selection.sceneId) return selection.sceneId;
    var scene = resolveAutoScene(rawContext);
    return scene ? scene.id : null;
  }

  function setSelectedSceneId(sceneId) {
    if (!findManualScene(sceneId)) return false;
    return writeSelection({ mode: "manual", sceneId: sceneId });
  }

  function setAutoMode() {
    return writeSelection({ mode: "auto" });
  }

  function applyToScreen(root, rawContext) {
    var screen = root || document.querySelector(".screen");
    if (!screen) return null;

    bindAutoRefresh();

    var selection = readSelection();
    var scene = null;
    if (selection.mode === "manual" && selection.sceneId) {
      scene = findManualScene(selection.sceneId);
    } else {
      scene = resolveAutoScene(rawContext);
    }

    screen.setAttribute("data-scene-mode", selection.mode);
    screen.classList.add("screen--has-scene");

    if (!scene) {
      screen.setAttribute("data-scene", "");
      var emptyImage = document.getElementById("app-scene-image");
      if (emptyImage) emptyImage.style.backgroundImage = "";
      return null;
    }

    screen.setAttribute("data-scene", scene.id);

    var layer = document.getElementById("app-scene");
    var imageEl = document.getElementById("app-scene-image");

    if (!layer) {
      layer = document.createElement("div");
      layer.className = "app-scene";
      layer.id = "app-scene";
      layer.setAttribute("aria-hidden", "true");

      imageEl = document.createElement("div");
      imageEl.className = "app-scene__image";
      imageEl.id = "app-scene-image";

      var veil = document.createElement("div");
      veil.className = "app-scene__veil";

      layer.appendChild(imageEl);
      layer.appendChild(veil);
      screen.insertBefore(layer, screen.firstChild);
    } else if (!imageEl) {
      imageEl = layer.querySelector(".app-scene__image");
    }

    if (imageEl) {
      imageEl.style.backgroundImage = 'url("' + scene.image.replace(/"/g, "") + '")';
    }

    return scene;
  }

  function renderAutoCard(grid, container, isSelected) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scene-picker__card";
    btn.setAttribute("role", "option");
    btn.setAttribute("data-scene-id", AUTO_ID);
    btn.setAttribute("aria-selected", isSelected ? "true" : "false");
    if (isSelected) btn.classList.add("is-selected");

    btn.innerHTML =
      '<span class="scene-picker__preview scene-picker__preview--auto" aria-hidden="true"></span>' +
      '<span class="scene-picker__title">Автоматически</span>' +
      '<span class="scene-picker__check" aria-hidden="true">✓</span>';

    btn.addEventListener("click", function () {
      if (!setAutoMode()) return;
      applyToScreen(document.querySelector(".screen"));
      renderPicker(container);
    });

    grid.appendChild(btn);
  }

  function renderPicker(container) {
    if (!container) return;

    var selection = readSelection();
    var selectedId = selection.mode === "auto" ? AUTO_ID : selection.sceneId;
    var scenes = getManualScenes();
    container.innerHTML = "";

    var grid = document.createElement("div");
    grid.className = "scene-picker__grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", "Фоновая сцена");

    renderAutoCard(grid, container, selectedId === AUTO_ID);

    for (var i = 0; i < scenes.length; i += 1) {
      (function (scene) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scene-picker__card";
        btn.setAttribute("role", "option");
        btn.setAttribute("data-scene-id", scene.id);
        btn.setAttribute("aria-selected", scene.id === selectedId ? "true" : "false");
        if (scene.id === selectedId) btn.classList.add("is-selected");

        btn.innerHTML =
          '<span class="scene-picker__preview" style="background-image:url(\'' +
          scene.image.replace(/'/g, "%27") +
          '\')"></span>' +
          '<span class="scene-picker__title">' +
          scene.title +
          "</span>" +
          '<span class="scene-picker__check" aria-hidden="true">✓</span>';

        btn.addEventListener("click", function () {
          if (!setSelectedSceneId(scene.id)) return;
          applyToScreen(document.querySelector(".screen"));
          renderPicker(container);
        });

        grid.appendChild(btn);
      })(scenes[i]);
    }

    container.appendChild(grid);
  }

  function bindAutoRefresh() {
    if (autoRefreshBound) return;
    autoRefreshBound = true;

    function refreshIfAuto() {
      if (readSelection().mode !== "auto") return;
      applyToScreen(document.querySelector(".screen"));
    }

    document.addEventListener("myday:weather-state", function (event) {
      var detail = event && event.detail ? event.detail : {};
      lastWeatherCondition = detail.status === "ok" ? normalizeWeather(detail.condition) : null;
      refreshIfAuto();
    });

    if (window.MyDayWeather && typeof window.MyDayWeather.whenReady === "function") {
      window.MyDayWeather.whenReady().then(function (weather) {
        if (weather && weather.status === "ok" && weather.now) {
          lastWeatherCondition = normalizeWeather(weather.now.condition);
        } else {
          lastWeatherCondition = null;
        }
        refreshIfAuto();
      }).catch(function () {
        lastWeatherCondition = null;
        refreshIfAuto();
      });
    }

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") refreshIfAuto();
    });

    var lastHour = new Date().getHours();
    window.setInterval(function () {
      var hour = new Date().getHours();
      if (hour === lastHour) return;
      lastHour = hour;
      refreshIfAuto();
    }, 60000);
  }

  global.MyDaySceneBackground = {
    getManualScenes: getManualScenes,
    getWeatherScenes: getWeatherScenes,
    getSelectedSceneId: getSelectedSceneId,
    setSelectedSceneId: setSelectedSceneId,
    setAutoMode: setAutoMode,
    getSelection: readSelection,
    resolveAutoScene: resolveAutoScene,
    applyToScreen: applyToScreen,
    renderPicker: renderPicker
  };
})(window);

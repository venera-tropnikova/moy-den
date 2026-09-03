(function (global) {
  "use strict";

  var CATALOG_URL = "assets/scenes/scenes.json?v=20260903-8";
  var STORAGE_KEY = "my-day-background-scene-v1";
  var DEFAULT_SCENE_ID = "coast-sun-gulls";
  var AUTO_ID = "__auto__";
  var AUTO_SCENE_IDS = {
    "coast-sun-gulls": true,
    "spring-blossom-bird": true,
    "autumn-mountain-glow": true,
    "mountain-rain-lake": true,
    "mountain-sunset-meadow": true,
    "winter-moon-village": true,
    "daisy-sunrise-mist": true,
    "autumn-island-boat": true,
    "poppy-sunset": true,
    "winter-lake-evening": true,
    "autumn-flowers-day": true
  };

  var FALLBACK_MANUAL = [
    {
      id: "coast-sun-gulls",
      title: "Солнечный берег",
      image: "assets/scenes/021d0b6a-f4db-4db7-96d7-c5dd81c14868.png",
      season: ["summer"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["morning", "day"]
    },
    {
      id: "spring-blossom-bird",
      title: "Весенняя сакура",
      image: "assets/scenes/a1acf2ea-bfbe-479e-a1f5-6fa3ec6daab3.png",
      season: ["spring"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["morning", "day"]
    },
    {
      id: "autumn-mountain-glow",
      title: "Осенние горы",
      image: "assets/scenes/0905a630-53db-49a0-b154-ac79990fb49b.png",
      season: ["autumn"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["day", "evening"]
    },
    {
      id: "mountain-rain-lake",
      title: "Дождь у озера",
      image: "assets/scenes/342ea465-cab7-4522-93cf-50c553bd6b77.png",
      season: ["spring", "summer", "autumn"],
      weather: ["rain"],
      daypart: ["morning", "day", "evening"]
    },
    {
      id: "mountain-sunset-meadow",
      title: "Горный закат",
      image: "assets/scenes/5418b18b-7ef6-4a6c-ae63-137500823229.png",
      season: ["spring", "summer", "autumn"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["evening"]
    },
    {
      id: "winter-moon-village",
      title: "Лунная ночь",
      image: "assets/scenes/c98f9610-c250-4ac5-b7ee-a9728bfe70ff.png",
      season: ["winter"],
      weather: ["clear", "partly_cloudy", "snow"],
      daypart: ["evening"]
    },
    {
      id: "daisy-sunrise-mist",
      title: "Ромашки на рассвете",
      image: "assets/scenes/837003f5-ca46-480e-9f23-d9b0cdd3f566.png",
      season: ["spring", "summer"],
      weather: ["clear", "partly_cloudy", "fog"],
      daypart: ["morning"]
    },
    {
      id: "autumn-island-boat",
      title: "Осенний остров",
      image: "assets/scenes/b9abfda8-8468-4dc0-9199-049a16014f02.png",
      season: ["autumn"],
      weather: ["fog", "partly_cloudy"],
      daypart: ["morning", "day"]
    },
    {
      id: "poppy-sunset",
      title: "Маки на закате",
      image: "assets/scenes/d857e818-b905-4438-a48f-2d7890470e50.png",
      season: ["summer"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["evening"]
    },
    {
      id: "winter-lake-evening",
      title: "Зимний вечер у озера",
      image: "assets/scenes/winter-lake-evening-v2.png",
      season: ["winter"],
      weather: ["snow", "cloudy"],
      daypart: ["evening"]
    },
    {
      id: "autumn-flowers-day",
      title: "Осенние цветы",
      image: "assets/scenes/autumn-flowers-day.png",
      season: ["autumn"],
      weather: ["clear", "partly_cloudy"],
      daypart: ["day"]
    }
  ];

  var catalogCache = null;
  var lastWeatherCondition = null;
  var autoRefreshBound = false;
  var pickerExpanded = false;

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

  function getAutoScenes() {
    var list = getManualScenes();
    var result = [];
    for (var i = 0; i < list.length; i += 1) {
      if (AUTO_SCENE_IDS[list[i].id]) result.push(list[i]);
    }
    return result;
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
    if (daypart === "night") return "evening";
    if (daypart === "morning" || daypart === "day" || daypart === "evening") {
      return daypart;
    }
    return null;
  }

  function normalizeContext(raw) {
    var source = raw && typeof raw === "object" ? raw : {};
    var date;
    if (source.date instanceof Date && !isNaN(source.date.getTime())) {
      date = source.date;
    } else if (window.MyDayTargetDate instanceof Date && !isNaN(window.MyDayTargetDate.getTime())) {
      date = window.MyDayTargetDate;
    } else {
      date = new Date();
    }
    return {
      date: date,
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

  function dateStamp(d) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function pickByDate(cands, date) {
    if (cands.length === 1) return cands[0];
    return cands[dateStamp(date) % cands.length];
  }

  function collectMatching(pool, ctx, needWeather, needDaypart) {
    var result = [];
    for (var i = 0; i < pool.length; i += 1) {
      var scene = pool[i];
      if (!hasTag(scene, "season", ctx.season)) continue;
      if (needWeather) {
        if (!ctx.weather || !hasTag(scene, "weather", ctx.weather)) continue;
      }
      if (needDaypart) {
        if (!ctx.daypart || !hasTag(scene, "daypart", ctx.daypart)) continue;
      }
      result.push(scene);
    }
    return result;
  }

  function hasStrongWeatherTag(scene) {
    var tags = tagList(scene, "weather");
    for (var i = 0; i < tags.length; i += 1) {
      if (tags[i] === "rain" || tags[i] === "snow" || tags[i] === "fog") return true;
    }
    return false;
  }

  function isSeasonFallbackAllowed(scene, weather) {
    if (weather == null) return true;
    if (hasStrongWeatherTag(scene)) return hasTag(scene, "weather", weather);
    return true;
  }

  function filterSeasonFallback(cands, weather) {
    var result = [];
    for (var i = 0; i < cands.length; i += 1) {
      if (isSeasonFallbackAllowed(cands[i], weather)) result.push(cands[i]);
    }
    return result;
  }

  function pickMostNeutralSeasonal(pool, ctx) {
    var sameSeason = [];
    var i;
    for (i = 0; i < pool.length; i += 1) {
      var scene = pool[i];
      if (!hasTag(scene, "season", ctx.season)) continue;
      if (scene.id === "mountain-rain-lake" && ctx.weather !== "rain") continue;
      sameSeason.push(scene);
    }

    var preferred = [];
    var rest = [];
    for (i = 0; i < sameSeason.length; i += 1) {
      var candidate = sameSeason[i];
      if (hasTag(candidate, "weather", "clear") || hasTag(candidate, "weather", "partly_cloudy")) {
        preferred.push(candidate);
      } else {
        rest.push(candidate);
      }
    }

    var group = preferred.length ? preferred : rest;
    if (!group.length) return null;
    return pickByDate(group, ctx.date);
  }

  function findPoolScene(pool, sceneId) {
    for (var i = 0; i < pool.length; i += 1) {
      if (pool[i].id === sceneId) return pool[i];
    }
    return null;
  }

  function resolveAutoScene(rawContext) {
    var ctx = normalizeContext(rawContext);
    var pool = getAutoScenes();
    var cands = [];

    if (!ctx.weather) {
      cands = filterSeasonFallback(collectMatching(pool, ctx, false, true), ctx.weather);
      if (!cands.length) {
        cands = filterSeasonFallback(collectMatching(pool, ctx, false, false), ctx.weather);
      }
    } else {
      cands = collectMatching(pool, ctx, true, true);
      if (!cands.length) cands = collectMatching(pool, ctx, true, false);
      if (!cands.length && ctx.weather === "rain") {
        return findPoolScene(pool, "mountain-rain-lake");
      }
      if (!cands.length) {
        cands = filterSeasonFallback(collectMatching(pool, ctx, false, true), ctx.weather);
      }
      if (!cands.length) {
        cands = filterSeasonFallback(collectMatching(pool, ctx, false, false), ctx.weather);
      }
      if (!cands.length) {
        var seasonal = pickMostNeutralSeasonal(pool, ctx);
        if (seasonal) return seasonal;
      }
    }

    if (cands.length) return pickByDate(cands, ctx.date);
    if (ctx.weather === "rain") return findPoolScene(pool, "mountain-rain-lake");
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

  function renderAutoCard(container, isSelected) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scene-picker__card scene-picker__card--auto";
    btn.setAttribute("data-scene-id", AUTO_ID);
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
    if (isSelected) btn.classList.add("is-selected");

    btn.innerHTML =
      '<span class="scene-picker__title">Автоматически</span>' +
      '<span class="scene-picker__subtitle">Подбирать по погоде, сезону и времени суток</span>' +
      '<span class="scene-picker__check" aria-hidden="true">✓</span>';

    btn.addEventListener("click", function () {
      if (!setAutoMode()) return;
      applyToScreen(document.querySelector(".screen"));
      pickerExpanded = false;
      renderPicker(container);
    });

    container.appendChild(btn);
  }

  function renderPicker(container) {
    if (!container) return;

    var selection = readSelection();
    var isAuto = selection.mode === "auto";
    var selectedId = isAuto ? AUTO_ID : selection.sceneId;
    var scenes = getManualScenes();
    var statusLabel = "Автоматически";

    if (!isAuto) {
      var selectedScene = findManualScene(selection.sceneId);
      if (selectedScene && selectedScene.title) {
        statusLabel = selectedScene.title;
      }
    }

    container.innerHTML = "";

    var summary = document.createElement("div");
    summary.className = "scene-picker__summary";

    var status = document.createElement("p");
    status.className = "scene-picker__status";
    status.textContent = statusLabel;

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "scene-picker__toggle";
    toggle.textContent = "Выбрать другой";
    toggle.setAttribute("aria-expanded", pickerExpanded ? "true" : "false");
    toggle.addEventListener("click", function () {
      pickerExpanded = !pickerExpanded;
      renderPicker(container);
    });

    summary.appendChild(status);
    summary.appendChild(toggle);
    container.appendChild(summary);

    if (!pickerExpanded) return;

    renderAutoCard(container, isAuto);

    var heading = document.createElement("h3");
    heading.className = "scene-picker__heading";
    heading.textContent = "Выбрать вручную";
    container.appendChild(heading);

    var grid = document.createElement("div");
    grid.className = "scene-picker__grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", "Выбрать вручную");

    for (var i = 0; i < scenes.length; i += 1) {
      (function (scene) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scene-picker__card";
        btn.setAttribute("role", "option");
        btn.setAttribute("data-scene-id", scene.id);
        var isSelected = !isAuto && scene.id === selectedId;
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        if (isSelected) btn.classList.add("is-selected");

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
          pickerExpanded = false;
          renderPicker(container);
        });

        grid.appendChild(btn);
      })(scenes[i]);
    }

    container.appendChild(grid);

    var footnote = document.createElement("p");
    footnote.className = "scene-picker__footnote";
    footnote.textContent =
      "Этот фон останется, пока вы снова не включите автоматический режим.";
    container.appendChild(footnote);
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

(function (global) {
  "use strict";

  var CATALOG_URL = "assets/scenes/scenes.json?v=20260823-3";
  var STORAGE_KEY = "my-day-background-scene-v1";
  var DEFAULT_SCENE_ID = "daisy-morning";

  var FALLBACK_MANUAL = [
    {
      id: "daisy-morning",
      title: "Ромашковое утро",
      image: "assets/scenes/daisy-morning.jpg"
    },
    {
      id: "forest-after-rain",
      title: "Лес после дождя",
      image: "assets/scenes/forest-after-rain.jpg"
    },
    {
      id: "mountain-morning",
      title: "Горное утро",
      image: "assets/scenes/mountain-morning.jpg"
    },
    {
      id: "sea-breeze",
      title: "Морской бриз",
      image: "assets/scenes/sea-breeze.jpg"
    }
  ];

  var catalogCache = null;

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

  function getSelectedSceneId() {
    var catalog = loadCatalogSync();
    try {
      var raw = localStorage.getItem(catalog.storageKey || STORAGE_KEY);
      if (!raw) return catalog.defaultSceneId || DEFAULT_SCENE_ID;

      var parsed = JSON.parse(raw);
      var id = "";
      if (typeof parsed === "string") {
        id = parsed;
      } else if (parsed && typeof parsed === "object" && typeof parsed.sceneId === "string") {
        id = parsed.sceneId;
      }

      if (id && findManualScene(id)) return id;
    } catch (error) {
      console.warn("Не удалось прочитать выбранный фон:", error);
    }

    return catalog.defaultSceneId || DEFAULT_SCENE_ID;
  }

  function setSelectedSceneId(sceneId) {
    if (!findManualScene(sceneId)) return false;
    var catalog = loadCatalogSync();

    try {
      localStorage.setItem(
        catalog.storageKey || STORAGE_KEY,
        JSON.stringify({
          mode: "manual",
          sceneId: sceneId,
          updatedAt: new Date().toISOString()
        })
      );
      return true;
    } catch (error) {
      console.warn("Не удалось сохранить фон:", error);
      return false;
    }
  }

  function applyToScreen(root) {
    var screen = root || document.querySelector(".screen");
    if (!screen) return null;

    var sceneId = getSelectedSceneId();
    var scene = findManualScene(sceneId) || findManualScene(DEFAULT_SCENE_ID) || getManualScenes()[0];
    if (!scene) return null;

    screen.setAttribute("data-scene", scene.id);
    screen.classList.add("screen--has-scene");

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

  function renderPicker(container) {
    if (!container) return;

    var selectedId = getSelectedSceneId();
    var scenes = getManualScenes();
    container.innerHTML = "";

    var grid = document.createElement("div");
    grid.className = "scene-picker__grid";
    grid.setAttribute("role", "listbox");
    grid.setAttribute("aria-label", "Фоновая сцена");

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

  global.MyDaySceneBackground = {
    getManualScenes: getManualScenes,
    getWeatherScenes: getWeatherScenes,
    getSelectedSceneId: getSelectedSceneId,
    setSelectedSceneId: setSelectedSceneId,
    applyToScreen: applyToScreen,
    renderPicker: renderPicker
  };
})(window);

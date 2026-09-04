(function () {
  "use strict";

  var RELOAD_KEY = "my-day-pwa-reload";
  var MDV_KEY = "my-day-pwa-mdv";

  try {
    window.sessionStorage.removeItem("my-day-sw-reloaded");
  } catch (e) {}

  if (!("serviceWorker" in navigator)) return;

  var hadController = !!navigator.serviceWorker.controller;
  var didNavigate = false;
  var checkInFlight = false;
  var reloadScheduled = false;
  var registerPromise = navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });

  function getMeta() {
    var el = document.querySelector('meta[name="my-day-release"]');
    var value = el && el.getAttribute("content");
    return value ? String(value) : "";
  }

  function getStore(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function setStore(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (err) {}
  }

  function removeStore(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (err) {}
  }

  function clearGuardsIfMatched(local, remote) {
    if (local && remote && local === remote) {
      removeStore(RELOAD_KEY);
      removeStore(MDV_KEY);
    }
  }

  function buildMdvUrl(remote) {
    var url = new URL(window.location.href);
    url.searchParams.set("mdv", remote);
    return url.pathname + url.search + url.hash;
  }

  function getUrlMdv() {
    try {
      return new URL(window.location.href).searchParams.get("mdv");
    } catch (err) {
      return null;
    }
  }

  function checkForUpdate(opts) {
    opts = opts || {};
    if (!("serviceWorker" in navigator)) return;
    if (didNavigate || checkInFlight || reloadScheduled) return;
    checkInFlight = true;

    var local = getMeta();
    var reg = null;

    function finish() {
      checkInFlight = false;
    }

    registerPromise
      .then(function (registration) {
        reg = registration;
        if (reg && typeof reg.update === "function") {
          return reg.update().catch(function () {});
        }
      })
      .catch(function () {})
      .then(function () {
        return fetch("version.json?t=" + Date.now(), { cache: "no-store" });
      })
      .then(function (response) {
        if (!response || !response.ok) return null;
        return response.json().then(function (data) {
          return data;
        }).catch(function () {
          return null;
        });
      })
      .catch(function () {
        return null;
      })
      .then(function (data) {
        if (!data || data.version == null || data.version === "") return;

        var remote = String(data.version);
        if (remote === local) {
          clearGuardsIfMatched(local, remote);
          return;
        }
        if (opts.skipReload) return;

        var urlMdv = getUrlMdv();
        if (urlMdv === remote) return;

        if (getStore(RELOAD_KEY) === remote) {
          if (getStore(MDV_KEY) === remote || urlMdv === remote) return;
          setStore(MDV_KEY, remote);
          didNavigate = true;
          window.location.replace(buildMdvUrl(remote));
          return;
        }

        setStore(RELOAD_KEY, remote);
        if (reg && reg.waiting) {
          try {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } catch (err) {}
          reloadScheduled = true;
          window.setTimeout(function () {
            if (!didNavigate) {
              didNavigate = true;
              window.location.reload();
            }
          }, 2000);
        } else {
          didNavigate = true;
          window.location.reload();
        }
      })
      .then(finish, finish);
  }

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (!hadController || didNavigate) return;
    if (!getStore(RELOAD_KEY)) return;
    didNavigate = true;
    window.location.reload();
  });

  window.addEventListener("pageshow", function (event) {
    if (event.persisted && getStore(RELOAD_KEY)) {
      checkForUpdate({ skipReload: true });
    } else {
      checkForUpdate();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      checkForUpdate();
    }
  });

  checkForUpdate();
})();

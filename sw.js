var VERSION = "20260904-3";

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  var isNav = req.mode === "navigate" || req.destination === "document";
  if (!isNav) return;
  event.respondWith(fetch(req, { cache: "no-store" }));
});

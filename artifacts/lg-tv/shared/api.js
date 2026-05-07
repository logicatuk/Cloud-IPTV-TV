/* Licensing API only — same contract as artifacts/maxplayer-app/lib/api.ts */
(function (global) {
  var API_BASE_KEY = "maxplayer_api_base";

  function normalizeBase(url) {
    if (!url) return "";
    var u = String(url).trim().replace(/\/+$/, "");
    return u;
  }

  function getApiBase() {
    return normalizeBase(localStorage.getItem(API_BASE_KEY));
  }

  function setApiBase(url) {
    localStorage.setItem(API_BASE_KEY, normalizeBase(url));
  }

  function registerDevice(macAddress) {
    var base = getApiBase();
    if (!base) return Promise.reject(new Error("API base not configured"));
    return fetch(base + "/v1/device/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac_address: macAddress }),
    }).then(function (res) {
      if (!res.ok) throw new Error("Register failed: " + res.status);
      return res.json();
    });
  }

  function getDeviceStatus(macAddress) {
    var base = getApiBase();
    if (!base) return Promise.reject(new Error("API base not configured"));
    return fetch(base + "/v1/device/status", {
      headers: { "X-MAC-Address": macAddress },
    }).then(function (res) {
      if (!res.ok) throw new Error("Status check failed: " + res.status);
      return res.json();
    });
  }

  function getAssignedPlaylist(macAddress) {
    var base = getApiBase();
    if (!base) return Promise.resolve(null);
    return fetch(base + "/v1/device/playlist", {
      headers: { "X-MAC-Address": macAddress },
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  global.MPApi = {
    getApiBase: getApiBase,
    setApiBase: setApiBase,
    API_BASE_KEY: API_BASE_KEY,
    registerDevice: registerDevice,
    getDeviceStatus: getDeviceStatus,
    getAssignedPlaylist: getAssignedPlaylist,
  };
})(window);

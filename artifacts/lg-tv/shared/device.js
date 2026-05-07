/* MaxPlayer TV — device MAC (aligned with artifacts/maxplayer-app/lib/device.ts) */
(function (global) {
  var MAC_KEY = "maxplayer_device_mac";

  function generateMac() {
    var parts = [];
    for (var i = 0; i < 6; i++) {
      var n = (Date.now() ^ Math.floor(Math.random() * 0xff)) & 0xff;
      parts.push(n.toString(16).padStart(2, "0"));
    }
    return parts.join(":").toUpperCase();
  }

  function getOrCreateDeviceMac() {
    try {
      var s = localStorage.getItem(MAC_KEY);
      if (s) return s;
      s = generateMac();
      localStorage.setItem(MAC_KEY, s);
      return s;
    } catch (e) {
      return generateMac();
    }
  }

  global.MPDevice = { getOrCreateDeviceMac: getOrCreateDeviceMac, MAC_KEY: MAC_KEY };
})(typeof window !== "undefined" ? window : this);

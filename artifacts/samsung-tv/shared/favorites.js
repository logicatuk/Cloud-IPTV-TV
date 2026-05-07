(function (global) {
  var KEY = "maxplayer_tv_favorites_v1";

  function empty() {
    return { live: [], vod: [], series: [] };
  }

  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (!d.live) d.live = [];
      if (!d.vod) d.vod = [];
      if (!d.series) d.series = [];
      return d;
    } catch (e) {
      return empty();
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function toggle(kind, id) {
    var d = load();
    var list = d[kind] || (d[kind] = []);
    var idStr = String(id);
    var i = list.indexOf(idStr);
    if (i >= 0) list.splice(i, 1);
    else list.push(idStr);
    save(d);
    return list.slice();
  }

  function has(kind, id) {
    var list = load()[kind] || [];
    return list.indexOf(String(id)) >= 0;
  }

  global.MPFavorites = { load: load, save: save, toggle: toggle, has: has };
})(window);

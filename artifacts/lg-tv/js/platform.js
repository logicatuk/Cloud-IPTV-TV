/**
 * LG webOS — HTML5 video with HLS mediaOption when available.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function tryPlay(url) {
    var v = $("html5video");
    if (!v) return;
    v.style.display = "block";
    var opt = JSON.stringify({
      mediaTransportType: "HLS",
      option: { useMediaPlayerPlugin: true, useNative: true },
    });
    function simple() {
      v.src = url;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    }
    try {
      if (typeof v.play === "function") {
        v.src = url;
        if (v.play.length >= 1) {
          try {
            v.play(opt);
            return;
          } catch (e1) {
            try {
              v.play(0, opt);
              return;
            } catch (e2) {}
          }
        }
      }
      simple();
    } catch (e) {
      simple();
    }
  }

  window.MPPlatform = {
    playHls: function (url) {
      tryPlay(url);
    },
    stop: function () {
      var v = $("html5video");
      if (!v) return;
      v.pause();
      v.removeAttribute("src");
      v.style.display = "none";
    },
    setVideoVisible: function (vis) {
      var v = $("html5video");
      if (v) v.style.display = vis ? "block" : "none";
    },
  };
})();

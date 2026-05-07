/**
 * Samsung Tizen — AVPlay for HLS; falls back to HTML5 video when AVPlay unavailable.
 */
(function () {
  function $(id) {
    return document.getElementById(id);
  }

  function getAvplay() {
    if (typeof webapis !== "undefined" && webapis.avplay) return webapis.avplay;
    return null;
  }

  function fallbackPlay(url) {
    var v = $("html5video");
    if (!v) return;
    v.style.display = "block";
    v.src = url;
    v.play().catch(function () {});
  }

  window.MPPlatform = {
    playHls: function (url) {
      var av = getAvplay();
      if (!av) {
        fallbackPlay(url);
        return;
      }
      try {
        av.stop();
        av.open(url);
        av.setDisplayRect(0, 0, window.innerWidth, window.innerHeight);
        if (av.setStreamingProperty) {
          try {
            av.setStreamingProperty("ADAPTIVE_INFO", "STARTBITRATE=2000000|SKIPBITRATE=2|STARTFRAGMENT=2");
          } catch (e1) {}
        }
        av.prepareAsync(
          function () {
            av.play();
          },
          function () {
            fallbackPlay(url);
          }
        );
      } catch (e) {
        fallbackPlay(url);
      }
    },
    stop: function () {
      var av = getAvplay();
      if (av) {
        try {
          av.stop();
        } catch (e) {}
      }
      var v = $("html5video");
      if (v) {
        v.pause();
        v.removeAttribute("src");
        v.style.display = "none";
      }
    },
    setVideoVisible: function (vis) {
      var v = $("html5video");
      if (v && getAvplay()) v.style.display = vis ? "block" : "none";
      if (!getAvplay() && v) v.style.display = vis ? "block" : "none";
    },
  };
})();

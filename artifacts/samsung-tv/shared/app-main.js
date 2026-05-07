/**
 * MaxPlayer TV — shared UI / navigation (Samsung Tizen + LG webOS).
 * Expects window.MPPlatform { playHls(url), stop(), setVideoVisible(visible), onPlayerError(cb) }
 */
(function () {
  var CREDS_KEY = "maxplayer_tv_xtream_json";

  var state = {
    view: "boot",
    creds: null,
    mac: "",
    pollTimer: null,
    deviceInfo: null,
    focus: { menu: 0, pane: "cat", ci: 0, chi: 0, mi: 0, mci: 0, si: 0, sci: 0, ei: 0, fi: 0, tab: 0 },
    liveCats: [],
    liveChannels: [],
    liveCatId: "all",
    vodCats: [],
    vodItems: [],
    vodCatId: "all",
    seriesCats: [],
    seriesItems: [],
    seriesCatId: "all",
    selectedMovie: null,
    selectedSeries: null,
    seriesInfo: null,
    seasonKeys: [],
    selectedSeason: "",
    episodes: [],
    epgChannel: null,
    epgList: [],
    searchQuery: "",
    searchResults: [],
    searchFocus: 0,
    favoritesTab: 0,
    activationMsg: "",
    settingsField: 0,
    playerReturn: null,
    modalMessage: null,
    _favVodList: [],
    _favSeriesList: [],
  };

  var homeItems = [
    { id: "live", label: "Live TV" },
    { id: "movies", label: "Movies" },
    { id: "series", label: "Series" },
    { id: "search", label: "Search" },
    { id: "favorites", label: "Favorites" },
    { id: "settings", label: "Settings" },
  ];

  function $(id) {
    return document.getElementById(id);
  }

  function loadCreds() {
    try {
      var s = localStorage.getItem(CREDS_KEY);
      if (!s) return null;
      var o = JSON.parse(s);
      return MPXtream.createXtreamCredentials(o.host, o.username, o.password, o.name || "TV");
    } catch (e) {
      return null;
    }
  }

  function saveCredsFromPlaylist(p) {
    if (!p || p.type !== "xtream" || !p.host || !p.username || !p.password) return;
    var c = MPXtream.createXtreamCredentials(p.host, p.username, p.password, "Assigned");
    localStorage.setItem(
      CREDS_KEY,
      JSON.stringify({ name: c.name, host: p.host, username: p.username, password: p.password })
    );
    state.creds = c;
  }

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function getFavFilteredList() {
    var favs = MPFavorites.load();
    var kind = ["live", "vod", "series"][state.favoritesTab];
    var ids = favs[kind] || [];
    if (kind === "live") {
      return state.liveChannels.filter(function (c) {
        return ids.indexOf(String(c.stream_id)) >= 0;
      });
    }
    if (kind === "vod") {
      return (state._favVodList || []).filter(function (c) {
        return ids.indexOf(String(c.stream_id)) >= 0;
      });
    }
    return (state._favSeriesList || []).filter(function (c) {
      return ids.indexOf(String(c.series_id)) >= 0;
    });
  }

  function showModal(msg) {
    state.modalMessage = msg;
    render();
  }

  function layoutShell(title, inner, hint) {
    hint = hint || "Arrow keys · OK · Back";
    return (
      '<div class="shell">' +
      '<header class="topbar"><div class="brand">MaxPlayer</div><div class="title">' +
      esc(title) +
      "</div></header>" +
      '<main class="main">' +
      inner +
      "</main>" +
      '<footer class="foot"><span>' +
      esc(hint) +
      "</span></footer>" +
      (state.modalMessage
        ? '<div class="modal"><div class="modal-box">' +
          esc(state.modalMessage) +
          '</div><div class="modal-hint">Press OK to close</div></div>'
        : "") +
      "</div>"
    );
  }

  function render() {
    var app = $("app");
    if (!app) return;

    if (state.view === "boot") {
      app.innerHTML = '<div class="shell center"><p class="loading">Loading…</p></div>';
      return;
    }

    if (state.view === "activation") {
      var inner =
        '<div class="activation">' +
        "<h1>Activate this TV</h1>" +
        "<p>Give this MAC address to your reseller:</p>" +
        '<div class="mac-box">' +
        esc(state.mac) +
        "</div>" +
        '<p class="sub">' +
        esc(state.activationMsg || "Waiting for activation…") +
        "</p></div>";
      app.innerHTML = layoutShell("Activation", inner);
      return;
    }

    if (state.view === "home") {
      var items = homeItems
        .map(function (it, i) {
          var cl = i === state.focus.menu ? "menu-item focused" : "menu-item";
          return '<div class="' + cl + '" data-i="' + i + '">' + esc(it.label) + "</div>";
        })
        .join("");
      app.innerHTML = layoutShell("Home", '<nav class="menu-col">' + items + "</nav>");
      return;
    }

    if (state.view === "live") {
      var cats = state.liveCats
        .map(function (c, i) {
          var id = String(c.category_id);
          var cl = state.focus.pane === "cat" && i === state.focus.ci ? "row focused" : "row";
          return (
            '<div class="' +
            cl +
            '" data-pane="cat" data-i="' +
            i +
            '" data-id="' +
            esc(id) +
            '">' +
            esc(c.category_name) +
            "</div>"
          );
        })
        .join("");
      var chs = state.liveChannels
        .map(function (c, i) {
          var cl = state.focus.pane === "ch" && i === state.focus.chi ? "row focused" : "row";
          var star = MPFavorites.has("live", c.stream_id) ? " ★" : "";
          return (
            '<div class="' +
            cl +
            '" data-pane="ch" data-i="' +
            i +
            '" data-sid="' +
            esc(c.stream_id) +
            '">' +
            esc(c.name) +
            star +
            "</div>"
          );
        })
        .join("");
      app.innerHTML = layoutShell(
        "Live TV",
        '<div class="split"><aside class="split-side">' +
          cats +
          '</aside><section class="split-main">' +
          chs +
          "</section></div>",
        "Left/Right: panes · Channel OK: play · *: favorite · #: EPG"
      );
      return;
    }

    if (state.view === "movies") {
      var mcats = [{ category_id: "all", category_name: "All" }].concat(state.vodCats);
      var chtml = mcats
        .map(function (c, i) {
          var id = String(c.category_id);
          var cl = state.focus.pane === "cat" && i === state.focus.ci ? "row focused" : "row";
          return (
            '<div class="' + cl + '" data-pane="cat" data-i="' + i + '" data-id="' + esc(id) + '">' + esc(c.category_name) + "</div>"
          );
        })
        .join("");
      var grid = state.vodItems
        .map(function (c, i) {
          var cl = state.focus.pane === "ch" && i === state.focus.chi ? "card focused" : "card";
          var star = MPFavorites.has("vod", c.stream_id) ? " ★" : "";
          return "<div class=\"" + cl + '" data-pane="ch" data-i="' + i + '"><div class="card-title">' + esc(c.name) + star + "</div></div>";
        })
        .join("");
      app.innerHTML = layoutShell(
        "Movies",
        '<div class="split"><aside class="split-side">' + chtml + '</aside><section class="grid">' + grid + "</section></div>"
      );
      return;
    }

    if (state.view === "movieDetail" && state.selectedMovie) {
      var m = state.selectedMovie;
      var inner =
        '<div class="detail"><h2>' +
        esc(m.name) +
        '</h2><p class="meta">Tap OK to play · BACK to list</p><button class="btn focused" tabindex="0">Play</button></div>';
      app.innerHTML = layoutShell("Movie", inner);
      return;
    }

    if (state.view === "series") {
      var scats = [{ category_id: "all", category_name: "All" }].concat(state.seriesCats);
      var schtml = scats
        .map(function (c, i) {
          var id = String(c.category_id);
          var cl = state.focus.pane === "cat" && i === state.focus.ci ? "row focused" : "row";
          return (
            '<div class="' + cl + '" data-pane="cat" data-i="' + i + '" data-id="' + esc(id) + '">' + esc(c.category_name) + "</div>"
          );
        })
        .join("");
      var sgrid = state.seriesItems
        .map(function (c, i) {
          var cl = state.focus.pane === "ch" && i === state.focus.chi ? "card focused" : "card";
          var star = MPFavorites.has("series", c.series_id) ? " ★" : "";
          return "<div class=\"" + cl + '" data-pane="ch" data-i="' + i + '"><div class="card-title">' + esc(c.name) + star + "</div></div>";
        })
        .join("");
      app.innerHTML = layoutShell(
        "Series",
        '<div class="split"><aside class="split-side">' + schtml + '</aside><section class="grid">' + sgrid + "</section></div>"
      );
      return;
    }

    if (state.view === "episodes") {
      var sea = state.selectedSeason ? " · Season " + esc(state.selectedSeason) : "";
      var rows = state.episodes
        .map(function (ep, i) {
          var cl = i === state.focus.ei ? "row focused" : "row";
          return '<div class="' + cl + '" data-i="' + i + '">S' + esc(ep.season) + " E" + esc(ep.episode_num) + " — " + esc(ep.title) + "</div>";
        })
        .join("");
      app.innerHTML = layoutShell("Episodes" + sea, '<div class="list-scroll">' + rows + "</div>", "Left/Right: season · Up/Down: episode");
      return;
    }

    if (state.view === "epg") {
      var inner =
        '<div class="epg"><h3>' +
        esc(state.epgChannel && state.epgChannel.name) +
        "</h3><div class=\"list-scroll\">" +
        state.epgList
          .map(function (e) {
            return (
              '<div class="epg-row"><span class="epg-time">' +
              esc(e.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) +
              '</span><span class="epg-title">' +
              esc(e.title) +
              "</span></div>"
            );
          })
          .join("") +
        "</div></div>";
      app.innerHTML = layoutShell("Guide", inner);
      return;
    }

    if (state.view === "search") {
      var inpClass = state.searchFocus === 0 ? "search-input focused" : "search-input";
      var btnClass = state.searchFocus === 1 ? "btn focused" : "btn";
      var res = state.searchResults
        .map(function (r, i) {
          var cl = state.searchFocus === 2 && i === state.focus.chi ? "row focused" : "row";
          var lab = r.kind + ": " + r.item.name;
          return '<div class="' + cl + '" data-si="' + i + '">' + esc(lab) + "</div>";
        })
        .join("");
      var inner =
        '<div class="search">' +
        '<input id="q" class="' +
        inpClass +
        '" type="text" placeholder="Search..." value="' +
        esc(state.searchQuery) +
        '"/>' +
        '<button type="button" id="searchBtn" class="' +
        btnClass +
        '">Search</button>' +
        '<div class="list-scroll search-results">' +
        res +
        "</div></div>";
      app.innerHTML = layoutShell("Search", inner);
      var qel = $("q");
      if (qel && state.searchFocus === 0) {
        try {
          qel.focus();
        } catch (e) {}
      }
      return;
    }

    if (state.view === "favorites") {
      var tabs = ["Live", "Movies", "Series"]
        .map(function (t, i) {
          var cl = state.favoritesTab === i ? "tab focused" : "tab";
          return '<span class="' + cl + '" data-ti="' + i + '">' + t + "</span>";
        })
        .join("  ");
      var flist = getFavFilteredList();
      var rows = flist
        .map(function (c, i) {
          var cl = i === state.focus.chi ? "row focused" : "row";
          return '<div class="' + cl + '" data-fi="' + i + '">' + esc(c.name) + "</div>";
        })
        .join("");
      app.innerHTML = layoutShell("Favorites", '<div class="fav"><div class="tabs">' + tabs + "</div><div class=\"list-scroll\">" + rows + "</div></div>");
      return;
    }

    if (state.view === "settings") {
      var api = MPApi.getApiBase() || "";
      var inner =
        '<div class="settings">' +
        "<label>License API base URL (https://your-host/api)</label>" +
        '<input id="apiBase" class="wide" type="text" value="' +
        esc(api) +
        '"/>' +
        "<p>MAC: " +
        esc(state.mac) +
        "</p>" +
        '<button type="button" id="saveSet" class="btn focused">Save</button>' +
        "</div>";
      app.innerHTML = layoutShell("Settings", inner);
      return;
    }

    if (state.view === "player") {
      app.innerHTML =
        '<div class="player-hud"><div class="hud-bar">Playing · Back to stop</div></div>';
      return;
    }
  }

  function stopPoll() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function startActivationPoll() {
    stopPoll();
    state.pollTimer = setInterval(function () {
      MPApi.getDeviceStatus(state.mac)
        .then(function (info) {
          state.deviceInfo = info;
          if (info.status === "active" && info.has_playlist) {
            stopPoll();
            MPApi.getAssignedPlaylist(state.mac).then(function (pl) {
              if (pl && pl.type === "m3u") {
                showModal("M3U playlists are not supported on TV yet.");
                state.activationMsg = "Assign an Xtream playlist to continue.";
                state.view = "activation";
                render();
                return;
              }
              saveCredsFromPlaylist(pl);
              if (!state.creds) {
                state.activationMsg = "No Xtream credentials returned.";
                render();
                return;
              }
              state.view = "home";
              state.focus.menu = 0;
              render();
            });
          } else {
            state.activationMsg = info.message || "Status: " + info.status;
            render();
          }
        })
        .catch(function () {});
    }, 5000);
  }

  function boot() {
    state.mac = MPDevice.getOrCreateDeviceMac();
    state.creds = loadCreds();

    if (!MPApi.getApiBase()) {
      state.view = "settings";
      render();
      return;
    }

    MPApi.registerDevice(state.mac).catch(function () {});

    if (state.creds) {
      state.view = "home";
      render();
      return;
    }

    MPApi.getDeviceStatus(state.mac)
      .then(function (info) {
        state.deviceInfo = info;
        if (info.status === "active" && info.has_playlist) {
          return MPApi.getAssignedPlaylist(state.mac).then(function (pl) {
            saveCredsFromPlaylist(pl);
            state.view = state.creds ? "home" : "activation";
            if (!state.creds) state.activationMsg = "Could not load playlist.";
            render();
            if (state.view === "activation") startActivationPoll();
          });
        }
        state.view = "activation";
        state.activationMsg = info.message || "Waiting for activation…";
        render();
        startActivationPoll();
      })
      .catch(function () {
        state.view = "activation";
        state.activationMsg = "Could not reach license server.";
        render();
        startActivationPoll();
      });
  }

  function loadLiveData() {
    return MPXtream.getLiveCategories(state.creds).then(function (cats) {
      state.liveCats = cats || [];
      state.focus = { menu: 0, pane: "cat", ci: 0, chi: 0, mi: 0, mci: 0, si: 0, sci: 0, ei: 0, fi: 0, tab: 0 };
      var firstId = state.liveCats.length ? String(state.liveCats[0].category_id) : "all";
      state.liveCatId = firstId;
      return MPXtream.getLiveStreams(state.creds, firstId).then(function (ch) {
        state.liveChannels = ch || [];
      });
    });
  }

  function loadVodData() {
    return MPXtream.getVodCategories(state.creds).then(function (cats) {
      state.vodCats = cats || [];
      state.focus = { menu: 0, pane: "cat", ci: 0, chi: 0, mi: 0, mci: 0, si: 0, sci: 0, ei: 0, fi: 0, tab: 0 };
      state.vodCatId = "all";
      return MPXtream.getVodStreams(state.creds, "all").then(function (items) {
        state.vodItems = items || [];
      });
    });
  }

  function loadSeriesData() {
    return MPXtream.getSeriesCategories(state.creds).then(function (cats) {
      state.seriesCats = cats || [];
      state.focus = { menu: 0, pane: "cat", ci: 0, chi: 0, mi: 0, mci: 0, si: 0, sci: 0, ei: 0, fi: 0, tab: 0 };
      state.seriesCatId = "all";
      return MPXtream.getSeriesList(state.creds, "all").then(function (items) {
        state.seriesItems = items || [];
      });
    });
  }

  function openLivePlayer(channel) {
    var url = MPXtream.buildLiveStreamUrl(state.creds, channel.stream_id);
    state.playerReturn = { view: "live", pane: state.focus.pane, ci: state.focus.ci, chi: state.focus.chi };
    state.view = "player";
    render();
    if (window.MPPlatform && window.MPPlatform.setVideoVisible) window.MPPlatform.setVideoVisible(true);
    window.MPPlatform.playHls(url);
  }

  function openVod(movie) {
    var ext = movie.container_extension || "mp4";
    var url = MPXtream.buildVodStreamUrl(state.creds, movie.stream_id, ext);
    state.playerReturn = { view: "movies" };
    state.view = "player";
    render();
    if (window.MPPlatform && window.MPPlatform.setVideoVisible) window.MPPlatform.setVideoVisible(true);
    window.MPPlatform.playHls(url);
  }

  function openEpisode(ep) {
    var ext = ep.container_extension || "mkv";
    var url = MPXtream.buildEpisodeStreamUrl(state.creds, ep.id, ext);
    state.playerReturn = { view: "episodes" };
    state.view = "player";
    render();
    if (window.MPPlatform && window.MPPlatform.setVideoVisible) window.MPPlatform.setVideoVisible(true);
    window.MPPlatform.playHls(url);
  }

  function closePlayer() {
    window.MPPlatform.stop();
    if (window.MPPlatform && window.MPPlatform.setVideoVisible) window.MPPlatform.setVideoVisible(false);
    var ret = state.playerReturn;
    state.playerReturn = null;
    if (ret) {
      state.view = ret.view;
      state.focus.pane = ret.pane || "ch";
      state.focus.ci = ret.ci != null ? ret.ci : state.focus.ci;
      state.focus.chi = ret.chi != null ? ret.chi : state.focus.chi;
    } else state.view = "home";
    render();
  }

  function runSearch() {
    var q = (state.searchQuery || "").trim().toLowerCase();
    if (q.length < 2) {
      state.searchResults = [];
      render();
      return;
    }
    Promise.all([
      MPXtream.getLiveStreams(state.creds).catch(function () {
        return [];
      }),
      MPXtream.getVodStreams(state.creds).catch(function () {
        return [];
      }),
      MPXtream.getSeriesList(state.creds).catch(function () {
        return [];
      }),
    ]).then(function (all) {
      var out = [];
      all[0].forEach(function (c) {
        if (String(c.name).toLowerCase().indexOf(q) >= 0) out.push({ kind: "live", item: c });
      });
      all[1].forEach(function (c) {
        if (String(c.name).toLowerCase().indexOf(q) >= 0) out.push({ kind: "vod", item: c });
      });
      all[2].forEach(function (c) {
        if (String(c.name).toLowerCase().indexOf(q) >= 0) out.push({ kind: "series", item: c });
      });
      state.searchResults = out.slice(0, 120);
      state.focus.chi = 0;
      render();
    });
  }

  function isBackKey(code) {
    return code === 10009 || code === 461 || code === 27 || code === 8;
  }

  function onKeyDown(e) {
    var k = e.keyCode;
    if (state.modalMessage) {
      if (k === 13 || k === 23) {
        state.modalMessage = null;
        render();
      }
      e.preventDefault();
      return;
    }

    if (state.view === "player") {
      if (isBackKey(k)) {
        e.preventDefault();
        closePlayer();
      }
      return;
    }

    if (state.view === "settings") {
      if (k === 13) {
        var input = $("apiBase");
        if (input) {
          MPApi.setApiBase(input.value);
          state.creds = loadCreds();
          state.view = "boot";
          render();
          boot();
        }
        e.preventDefault();
      } else if (isBackKey(k) && state.creds) {
        state.view = "home";
        render();
        e.preventDefault();
      }
      return;
    }

    if (state.view === "home") {
      if (k === 40) {
        state.focus.menu = Math.min(homeItems.length - 1, state.focus.menu + 1);
        render();
      } else if (k === 38) {
        state.focus.menu = Math.max(0, state.focus.menu - 1);
        render();
      } else if (k === 13) {
        var sel = homeItems[state.focus.menu].id;
        if (sel === "live") {
          loadLiveData().then(function () {
            state.view = "live";
            render();
          });
        } else if (sel === "movies") {
          loadVodData().then(function () {
            state.view = "movies";
            render();
          });
        } else if (sel === "series") {
          loadSeriesData().then(function () {
            state.view = "series";
            render();
          });
        } else if (sel === "search") {
          state.view = "search";
          state.searchFocus = 0;
          state.searchResults = [];
          render();
        } else if (sel === "favorites") {
          Promise.all([
            MPXtream.getLiveStreams(state.creds),
            MPXtream.getVodStreams(state.creds),
            MPXtream.getSeriesList(state.creds),
          ])
            .then(function (all) {
              state.liveChannels = all[0] || [];
              state._favVodList = all[1] || [];
              state._favSeriesList = all[2] || [];
              state.view = "favorites";
              state.favoritesTab = 0;
              state.focus.chi = 0;
              render();
            })
            .catch(function () {
              showModal("Could not load favorites.");
            });
        } else if (sel === "settings") {
          state.view = "settings";
          render();
        }
        e.preventDefault();
      } else if (isBackKey(k)) {
        e.preventDefault();
      }
      return;
    }

    if (state.view === "live") {
      if (isBackKey(k)) {
        state.view = "home";
        render();
        e.preventDefault();
        return;
      }
      if (k === 37) {
        state.focus.pane = "cat";
        render();
      } else if (k === 39) {
        state.focus.pane = "ch";
        render();
      } else if (k === 38) {
        if (state.focus.pane === "cat") {
          state.focus.ci = Math.max(0, state.focus.ci - 1);
          var c = state.liveCats[state.focus.ci];
          if (c) {
            state.liveCatId = String(c.category_id);
            MPXtream.getLiveStreams(state.creds, state.liveCatId).then(function (ch) {
              state.liveChannels = ch || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.max(0, state.focus.chi - 1);
        render();
      } else if (k === 40) {
        if (state.focus.pane === "cat") {
          state.focus.ci = Math.min(state.liveCats.length - 1, state.focus.ci + 1);
          var c2 = state.liveCats[state.focus.ci];
          if (c2) {
            state.liveCatId = String(c2.category_id);
            MPXtream.getLiveStreams(state.creds, state.liveCatId).then(function (ch) {
              state.liveChannels = ch || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.min(state.liveChannels.length - 1, state.focus.chi + 1);
        render();
      } else if (k === 13 && state.focus.pane === "ch") {
        var chn = state.liveChannels[state.focus.chi];
        if (chn) openLivePlayer(chn);
        e.preventDefault();
      } else if ((k === 106 || k === 56) && state.focus.pane === "ch") {
        var chnF = state.liveChannels[state.focus.chi];
        if (chnF) {
          MPFavorites.toggle("live", chnF.stream_id);
          render();
        }
      } else if (k === 35 || k === 71) {
        var chg = state.liveChannels[state.focus.chi];
        if (chg) {
          MPXtream.getChannelEpg(state.creds, chg.stream_id).then(function (list) {
            state.epgChannel = chg;
            state.epgList = list;
            state.view = "epg";
            render();
          });
        }
      }
      e.preventDefault();
      return;
    }

    if (state.view === "movies") {
      if (isBackKey(k)) {
        state.view = "home";
        render();
        e.preventDefault();
        return;
      }
      if (k === 37) state.focus.pane = "cat";
      else if (k === 39) state.focus.pane = "ch";
      else if (k === 38) {
        if (state.focus.pane === "cat") {
          state.focus.ci = Math.max(0, state.focus.ci - 1);
          var mc = [{ category_id: "all", category_name: "All" }].concat(state.vodCats)[state.focus.ci];
          if (mc) {
            state.vodCatId = String(mc.category_id);
            MPXtream.getVodStreams(state.creds, state.vodCatId).then(function (items) {
              state.vodItems = items || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.max(0, state.focus.chi - 1);
      } else if (k === 40) {
        if (state.focus.pane === "cat") {
          var mcats = [{ category_id: "all", category_name: "All" }].concat(state.vodCats);
          state.focus.ci = Math.min(mcats.length - 1, state.focus.ci + 1);
          var mc2 = mcats[state.focus.ci];
          if (mc2) {
            state.vodCatId = String(mc2.category_id);
            MPXtream.getVodStreams(state.creds, state.vodCatId).then(function (items) {
              state.vodItems = items || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.min(state.vodItems.length - 1, state.focus.chi + 1);
      } else if (k === 13 && state.focus.pane === "ch") {
        var mv = state.vodItems[state.focus.chi];
        if (mv) {
          state.selectedMovie = mv;
          state.view = "movieDetail";
          render();
        }
      } else if ((k === 106 || k === 56) && state.focus.pane === "ch") {
        var mvF = state.vodItems[state.focus.chi];
        if (mvF) {
          MPFavorites.toggle("vod", mvF.stream_id);
          render();
        }
      }
      render();
      e.preventDefault();
      return;
    }

    if (state.view === "movieDetail") {
      if (isBackKey(k)) {
        state.view = "movies";
        render();
      } else if (k === 13 && state.selectedMovie) {
        openVod(state.selectedMovie);
      }
      e.preventDefault();
      return;
    }

    if (state.view === "series") {
      if (isBackKey(k)) {
        state.view = "home";
        render();
        e.preventDefault();
        return;
      }
      if (k === 37) state.focus.pane = "cat";
      else if (k === 39) state.focus.pane = "ch";
      else if (k === 38) {
        if (state.focus.pane === "cat") {
          state.focus.ci = Math.max(0, state.focus.ci - 1);
          var sc = [{ category_id: "all", category_name: "All" }].concat(state.seriesCats)[state.focus.ci];
          if (sc) {
            state.seriesCatId = String(sc.category_id);
            MPXtream.getSeriesList(state.creds, state.seriesCatId).then(function (items) {
              state.seriesItems = items || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.max(0, state.focus.chi - 1);
      } else if (k === 40) {
        if (state.focus.pane === "cat") {
          var scats = [{ category_id: "all", category_name: "All" }].concat(state.seriesCats);
          state.focus.ci = Math.min(scats.length - 1, state.focus.ci + 1);
          var sc2 = scats[state.focus.ci];
          if (sc2) {
            state.seriesCatId = String(sc2.category_id);
            MPXtream.getSeriesList(state.creds, state.seriesCatId).then(function (items) {
              state.seriesItems = items || [];
              state.focus.chi = 0;
              render();
            });
          }
        } else state.focus.chi = Math.min(state.seriesItems.length - 1, state.focus.chi + 1);
      } else if (k === 13 && state.focus.pane === "ch") {
        var sr = state.seriesItems[state.focus.chi];
        if (sr) {
          state.selectedSeries = sr;
          MPXtream.getSeriesInfo(state.creds, sr.series_id).then(function (info) {
            state.seriesInfo = info;
            state.seasonKeys = Object.keys(info.episodes || {}).sort();
            state.selectedSeason = state.seasonKeys[0] || "";
            state.episodes = (info.episodes && info.episodes[state.selectedSeason]) || [];
            state.view = "episodes";
            state.focus.ei = 0;
            render();
          });
        }
      } else if ((k === 106 || k === 56) && state.focus.pane === "ch") {
        var srF = state.seriesItems[state.focus.chi];
        if (srF) {
          MPFavorites.toggle("series", srF.series_id);
          render();
        }
      }
      render();
      e.preventDefault();
      return;
    }

    if (state.view === "episodes") {
      if (isBackKey(k)) {
        state.view = "series";
        render();
      } else if (k === 37 || k === 39) {
        if (state.seasonKeys.length > 1) {
          var idx = state.seasonKeys.indexOf(state.selectedSeason);
          if (idx < 0) idx = 0;
          if (k === 37) idx = Math.max(0, idx - 1);
          else idx = Math.min(state.seasonKeys.length - 1, idx + 1);
          state.selectedSeason = state.seasonKeys[idx];
          state.episodes =
            (state.seriesInfo && state.seriesInfo.episodes && state.seriesInfo.episodes[state.selectedSeason]) || [];
          state.focus.ei = 0;
          render();
        }
      } else if (k === 38) {
        state.focus.ei = Math.max(0, state.focus.ei - 1);
        render();
      } else if (k === 40) {
        state.focus.ei = Math.min(state.episodes.length - 1, state.focus.ei + 1);
        render();
      } else if (k === 13) {
        var ep = state.episodes[state.focus.ei];
        if (ep) openEpisode(ep);
      }
      e.preventDefault();
      return;
    }

    if (state.view === "epg") {
      if (isBackKey(k)) {
        state.view = "live";
        render();
      }
      e.preventDefault();
      return;
    }

    if (state.view === "search") {
      if (isBackKey(k)) {
        state.view = "home";
        render();
        e.preventDefault();
        return;
      }
      if (k === 38) {
        state.searchFocus = Math.max(0, state.searchFocus - 1);
        render();
      } else if (k === 40) {
        state.searchFocus = Math.min(2, state.searchFocus + 1);
        render();
      } else if (k === 13) {
        if (state.searchFocus === 0) {
          var q = $("q");
          if (q) state.searchQuery = q.value;
        } else if (state.searchFocus === 1) {
          var q2 = $("q");
          if (q2) state.searchQuery = q2.value;
          runSearch();
        } else if (state.searchFocus === 2 && state.searchResults.length) {
          var r = state.searchResults[state.focus.chi];
          if (r.kind === "live") openLivePlayer(r.item);
          else if (r.kind === "vod") {
            state.selectedMovie = r.item;
            openVod(r.item);
          } else if (r.kind === "series") {
            state.selectedSeries = r.item;
            MPXtream.getSeriesInfo(state.creds, r.item.series_id).then(function (info) {
              state.seriesInfo = info;
              state.seasonKeys = Object.keys(info.episodes || {}).sort();
              state.selectedSeason = state.seasonKeys[0] || "";
              state.episodes = (info.episodes && info.episodes[state.selectedSeason]) || [];
              state.view = "episodes";
              state.focus.ei = 0;
              render();
            });
          }
        }
      }
      e.preventDefault();
      return;
    }

    if (state.view === "favorites") {
      if (isBackKey(k)) {
        state.view = "home";
        render();
        e.preventDefault();
        return;
      }
      var flen = getFavFilteredList().length;
      if (k === 37) {
        state.favoritesTab = Math.max(0, state.favoritesTab - 1);
        state.focus.chi = 0;
        render();
      } else if (k === 39) {
        state.favoritesTab = Math.min(2, state.favoritesTab + 1);
        state.focus.chi = 0;
        render();
      } else if (k === 38) {
        state.focus.chi = Math.max(0, state.focus.chi - 1);
        render();
      } else if (k === 40) {
        state.focus.chi = Math.min(Math.max(0, flen - 1), state.focus.chi + 1);
        render();
      } else if (k === 13) {
        var favItems = getFavFilteredList();
        var item = favItems[state.focus.chi];
        if (!item) {
          e.preventDefault();
          return;
        }
        if (state.favoritesTab === 0) openLivePlayer(item);
        else if (state.favoritesTab === 1) openVod(item);
        else {
          state.selectedSeries = item;
          MPXtream.getSeriesInfo(state.creds, item.series_id).then(function (info) {
            state.seriesInfo = info;
            state.seasonKeys = Object.keys(info.episodes || {}).sort();
            state.selectedSeason = state.seasonKeys[0] || "";
            state.episodes = (info.episodes && info.episodes[state.selectedSeason]) || [];
            state.view = "episodes";
            state.focus.ei = 0;
            render();
          });
        }
      }
      e.preventDefault();
      return;
    }

    if (state.view === "activation") {
      if (isBackKey(k)) e.preventDefault();
    }
  }

  function init() {
    if (!window.MPPlatform) {
      window.MPPlatform = {
        playHls: function (url) {
          var v = $("html5video");
          if (!v) return;
          v.style.display = "block";
          v.src = url;
          v.play().catch(function () {});
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
    }
    state.view = "boot";
    render();
    document.addEventListener("keydown", onKeyDown);
    boot();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

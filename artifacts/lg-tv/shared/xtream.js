/* Xtream Codes client — ported from artifacts/maxplayer-app/lib/xtream.ts */
(function (global) {
  function createXtreamCredentials(host, username, password, name) {
    var h = String(host).trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(h)) h = "http://" + h;
    return { type: "xtream", name: name || "My Playlist", host: h, username: username, password: password };
  }

  function apiUrl(creds, action, extra) {
    extra = extra || {};
    var params = new URLSearchParams();
    params.set("username", creds.username);
    params.set("password", creds.password);
    params.set("action", action);
    Object.keys(extra).forEach(function (k) {
      params.set(k, String(extra[k]));
    });
    return creds.host + "/player_api.php?" + params.toString();
  }

  function xFetch(url, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, timeoutMs);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error("Xtream error " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data === false || data === null) throw new Error("Xtream returned empty response");
        return data;
      })
      .catch(function (e) {
        clearTimeout(timer);
        throw e;
      });
  }

  function getLiveCategories(creds) {
    return xFetch(apiUrl(creds, "get_live_categories"));
  }

  function getLiveStreams(creds, categoryId) {
    var extra = {};
    if (categoryId && categoryId !== "all") extra.category_id = categoryId;
    return xFetch(apiUrl(creds, "get_live_streams", extra));
  }

  function buildLiveStreamUrl(creds, streamId) {
    return creds.host + "/live/" + creds.username + "/" + creds.password + "/" + streamId + ".m3u8";
  }

  function getVodCategories(creds) {
    return xFetch(apiUrl(creds, "get_vod_categories"));
  }

  function getVodStreams(creds, categoryId) {
    var extra = {};
    if (categoryId && categoryId !== "all") extra.category_id = categoryId;
    return xFetch(apiUrl(creds, "get_vod_streams", extra));
  }

  function getVodInfo(creds, vodId) {
    return xFetch(apiUrl(creds, "get_vod_info", { vod_id: vodId }));
  }

  function buildVodStreamUrl(creds, streamId, ext) {
    var e = ext || "mp4";
    return creds.host + "/movie/" + creds.username + "/" + creds.password + "/" + streamId + "." + e;
  }

  function getSeriesCategories(creds) {
    return xFetch(apiUrl(creds, "get_series_categories"));
  }

  function getSeriesList(creds, categoryId) {
    var extra = {};
    if (categoryId && categoryId !== "all") extra.category_id = categoryId;
    return xFetch(apiUrl(creds, "get_series", extra));
  }

  function getSeriesInfo(creds, seriesId) {
    return xFetch(apiUrl(creds, "get_series_info", { series_id: seriesId }), 20000);
  }

  function buildEpisodeStreamUrl(creds, episodeId, ext) {
    var e = ext || "mkv";
    return creds.host + "/series/" + creds.username + "/" + creds.password + "/" + episodeId + "." + e;
  }

  function decodeEpgText(encoded) {
    if (!encoded) return "";
    try {
      var raw = atob(encoded);
      try {
        return decodeURIComponent(escape(raw));
      } catch (e2) {
        return raw;
      }
    } catch (e) {
      return String(encoded);
    }
  }

  function parseEpgEntry(raw) {
    return {
      id: raw.id,
      title: decodeEpgText(raw.title),
      description: decodeEpgText(raw.description),
      start: new Date(raw.start_timestamp * 1000),
      end: new Date(raw.stop_timestamp * 1000),
      startTimestamp: raw.start_timestamp,
      endTimestamp: raw.stop_timestamp,
    };
  }

  function getShortEpg(creds, streamId, limit) {
    limit = limit || 4;
    return xFetch(apiUrl(creds, "get_short_epg", { stream_id: streamId, limit: limit }), 10000).then(function (data) {
      return (data.epg_listings || []).map(parseEpgEntry);
    });
  }

  function getChannelEpg(creds, streamId) {
    return xFetch(apiUrl(creds, "get_simple_data_table", { stream_id: streamId }), 15000).then(function (data) {
      return (data.epg_listings || []).map(parseEpgEntry);
    });
  }

  function getAccountInfo(creds) {
    var url =
      creds.host +
      "/player_api.php?username=" +
      encodeURIComponent(creds.username) +
      "&password=" +
      encodeURIComponent(creds.password);
    return xFetch(url, 10000).then(function (data) {
      var ui = data.user_info || {};
      return {
        username: ui.username || creds.username,
        status: ui.status || "Unknown",
        expDate: ui.exp_date ? Number(ui.exp_date) : null,
        isTrial: ui.is_trial === "1" || ui.is_trial === 1,
        maxConnections: Number(ui.max_connections || 1),
        activeConnections: Number(ui.active_cons || 0),
      };
    });
  }

  global.MPXtream = {
    createXtreamCredentials: createXtreamCredentials,
    getLiveCategories: getLiveCategories,
    getLiveStreams: getLiveStreams,
    buildLiveStreamUrl: buildLiveStreamUrl,
    getVodCategories: getVodCategories,
    getVodStreams: getVodStreams,
    getVodInfo: getVodInfo,
    buildVodStreamUrl: buildVodStreamUrl,
    getSeriesCategories: getSeriesCategories,
    getSeriesList: getSeriesList,
    getSeriesInfo: getSeriesInfo,
    buildEpisodeStreamUrl: buildEpisodeStreamUrl,
    getShortEpg: getShortEpg,
    getChannelEpg: getChannelEpg,
    getAccountInfo: getAccountInfo,
  };
})(window);

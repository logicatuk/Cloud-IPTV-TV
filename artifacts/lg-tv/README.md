# MaxPlayer — LG webOS

## Prerequisites

- [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-installation) or WebOS TV IDE.
- LG TV with **Developer Mode** enabled for app installation.

## Project files

- `appinfo.json` — set `id`, `title`, and `version` for store or sideload workflows; `main` is `index.html`.
- `js/platform.js` — plays HLS in `<video id="html5video">` using `mediaTransportType: "HLS"` when supported, otherwise plain `src` + `play()`.
- `shared/*.js` — copied from `../tv-shared/js/`; resync after edits (see [MAXPLAYER_TV_APPS.md](../../MAXPLAYER_TV_APPS.md)).

## Run

From the `artifacts/lg-tv` directory (with webOS CLI configured):

```bash
ares-package .
ares-install --device <device-name> com.maxplayer.tv_*.ipk
```

Replace package name with the artifact produced by `ares-package`. Use your registered app id if you change `appinfo.json`.

On first launch, set the **license API base URL** in Settings so the app can register the TV MAC and load the reseller playlist.

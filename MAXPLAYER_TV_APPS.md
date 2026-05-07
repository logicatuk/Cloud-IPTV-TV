# MaxPlayer TV apps (Samsung Tizen + LG webOS)

Vanilla HTML/JS clients under `artifacts/` share the same licensing model as the Expo mobile app: MAC registration, poll `device/status`, `device/playlist` for Xtream credentials, then direct Xtream API calls. See [replit.md](replit.md) and [MAXPLAYER_MOBILE_APP.md](MAXPLAYER_MOBILE_APP.md) for API details.

## Layout

| Path | Role |
|------|------|
| [artifacts/tv-shared/js/](artifacts/tv-shared/js/) | Canonical shared modules (`device`, `api`, `xtream`, `favorites`, `app-main`). |
| [artifacts/tv-shared/css/app.css](artifacts/tv-shared/css/app.css) | Shared stylesheet (copied into each TV `css/` for packaging). |
| [artifacts/samsung-tv/](artifacts/samsung-tv/) | Tizen widget: `config.xml`, `index.html`, AVPlay in `js/platform.js`. |
| [artifacts/lg-tv/](artifacts/lg-tv/) | webOS app: `appinfo.json`, `index.html`, `<video>` + HLS options in `js/platform.js`. |

Each TV folder has a **`shared/`** copy of the JS files for self-contained WGT/IPK builds. After editing `tv-shared/js`, resync:

```bash
cp artifacts/tv-shared/js/*.js artifacts/samsung-tv/shared/
cp artifacts/tv-shared/js/*.js artifacts/lg-tv/shared/
cp artifacts/tv-shared/css/app.css artifacts/samsung-tv/css/app.css
cp artifacts/tv-shared/css/app.css artifacts/lg-tv/css/app.css
```

## First run

1. Open the app; it prompts for **License API base URL** (e.g. `https://your-server.example.com/api`).
2. Complete reseller activation for the displayed **MAC**; wait for poll or restart after assignment.
3. Xtream playlists from the CMS unlock **Live TV, Movies, Series, Search, Favorites, EPG (# on a channel)**. M3U-only assignments show a clear message (not supported on TV yet).

## Samsung Tizen

- Edit `config.xml`: set `tizen:application` **id** and **package** to match your Tizen Studio **certificate**.
- Open the project in **Tizen Studio**, enable **Samsung Extension** / AVPlay as needed for your target year model.
- Device install: build signed `.wgt` and install on TV (developer mode + IP upload or USB).

## LG webOS

- Install **webOS CLI** / WebOS TV IDE; from `artifacts/lg-tv`, package with your app id (change `appinfo.json` if needed).
- Run on emulator or TV with developer mode.

## Remote hints

- **D-pad** moves focus; **OK** selects.
- **Back** (Samsung `10009`, webOS `461`, or ESC in browser) closes the player or goes up a screen.
- Live TV: **\*** (or `8` on some remotes) toggles favorite on the focused channel; **#** or **G** opens full EPG for that channel.

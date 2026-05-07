# MaxPlayer — Samsung Tizen

## Prerequisites

- [Tizen Studio](https://developer.tizen.org/) with TV / Wearable extensions as required for your SDK profile.
- Samsung TV **developer mode** on the target device for sideloading.

## Project files

- `config.xml` — widget manifest. Replace `MAXPLAYERTV1` in `tizen:application` id/package with values tied to your **signing certificate** (Tizen Certificate Manager).
- `index.html` — loads `$WEBAPIS` for `webapis.avplay`.
- `js/platform.js` — HLS via **AVPlay**, falls back to the hidden `<video id="html5video">` if AVPlay fails.
- `shared/*.js` — copied from `../tv-shared/js/`; keep in sync (see [MAXPLAYER_TV_APPS.md](../../MAXPLAYER_TV_APPS.md)).

## Run

1. Import or open this folder as a **Tizen Web Application** project.
2. Select a **TV** device profile / emulator.
3. Run or build signed **`.wgt`** and install on the television.

If styles or scripts change upstream, recopy `tv-shared` assets into `css/` and `shared/` before packaging.

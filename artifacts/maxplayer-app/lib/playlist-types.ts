export interface XtreamPlaylist {
  id: string;
  name: string;
  type: "xtream";
  host: string;
  username: string;
  password: string;
  addedAt: string;
}

export interface M3UPlaylist {
  id: string;
  name: string;
  type: "m3u";
  url: string;
  addedAt: string;
}

export type AnyPlaylist = XtreamPlaylist | M3UPlaylist;

export function generatePlaylistId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import { pgTable, uuid, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { devicesTable } from "./devices";
import { iptvServersTable } from "./iptv_servers";

export const playlistTypeEnum = pgEnum("playlist_type", ["m3u", "xtream"]);

export const playlistsTable = pgTable("playlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceId: uuid("device_id").unique().references(() => devicesTable.id, { onDelete: "cascade" }),
  type: playlistTypeEnum("type").notNull(),
  m3uUrl: varchar("m3u_url", { length: 1000 }),
  xtreamHost: varchar("xtream_host", { length: 500 }),
  xtreamUsername: varchar("xtream_username", { length: 255 }),
  xtreamPasswordEnc: varchar("xtream_password_enc", { length: 500 }),
  serverId: uuid("server_id").references(() => iptvServersTable.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPlaylistSchema = createInsertSchema(playlistsTable).omit({ id: true });
export type InsertPlaylist = z.infer<typeof insertPlaylistSchema>;
export type Playlist = typeof playlistsTable.$inferSelect;

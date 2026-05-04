import { pgTable, uuid, varchar, integer, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serverStatusEnum = pgEnum("server_status", ["active", "inactive"]);

export const iptvServersTable = pgTable("iptv_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  host: varchar("host", { length: 500 }).notNull(),
  username: varchar("username", { length: 255 }).notNull(),
  passwordEnc: varchar("password_enc", { length: 500 }).notNull(),
  status: serverStatusEnum("status").default("active"),
  maxConnections: integer("max_connections").default(1000),
  notes: text("notes"),
  lastCheckedAt: timestamp("last_checked_at"),
  isOnline: boolean("is_online").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIptvServerSchema = createInsertSchema(iptvServersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIptvServer = z.infer<typeof insertIptvServerSchema>;
export type IptvServer = typeof iptvServersTable.$inferSelect;

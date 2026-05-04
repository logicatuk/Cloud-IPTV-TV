import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { devicesTable } from "./devices";

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  deviceId: uuid("device_id").references(() => devicesTable.id),
  token: varchar("token", { length: 500 }).unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type RefreshToken = typeof refreshTokensTable.$inferSelect;

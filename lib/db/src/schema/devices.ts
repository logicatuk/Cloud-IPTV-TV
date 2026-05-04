import { pgTable, uuid, varchar, integer, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const licenseTierEnum = pgEnum("license_tier", ["1year", "2year", "lifetime"]);
export const deviceStatusEnum = pgEnum("device_status", ["active", "suspended", "expired"]);

export const devicesTable = pgTable("devices", {
  id: uuid("id").primaryKey().defaultRandom(),
  macAddress: varchar("mac_address", { length: 17 }).unique().notNull(),
  name: varchar("name", { length: 255 }),
  resellerId: uuid("reseller_id").notNull().references(() => usersTable.id),
  licenseTier: licenseTierEnum("license_tier").notNull(),
  creditsUsed: integer("credits_used").notNull(),
  status: deviceStatusEnum("status").notNull().default("active"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  registeredAt: timestamp("registered_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type Device = typeof devicesTable.$inferSelect;

"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { ROLES } from "./schema";
import mysql from "mysql2/promise";

/**
 * PlanetScale (MySQL) integration.
 *
 * The backend reads the PlanetScale connection string from the
 * `DATABASE_URL` environment variable (set via the project Keys tab, then
 * synced to Convex environment variables). `testConnection` verifies the
 * connection from the Node runtime and returns basic server info.
 */
export const testConnection = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.PENGGURUS)) {
      throw new Error("Hanya admin atau pengurus yang dapat menguji koneksi.");
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return {
        configured: false,
        ok: false,
        message: "DATABASE_URL belum diatur di Keys.",
      };
    }

    let connection: mysql.Connection | null = null;
    try {
      const url = new URL(databaseUrl);
      connection = await mysql.createConnection({
        host: url.hostname,
        port: url.port ? Number(url.port) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, ""),
        // PlanetScale requires SSL/TLS connections.
        ssl: { rejectUnauthorized: true },
        connectTimeout: 10000,
      });

      const [rows] = await connection.query<mysql.RowDataPacket[]>(
        "SELECT VERSION() AS version, DATABASE() AS database_name, NOW() AS server_time",
      );
      const row = rows[0] as
        | { version: string; database_name: string; server_time: Date }
        | undefined;

      return {
        configured: true,
        ok: true,
        version: row?.version ?? null,
        database: row?.database_name ?? null,
        serverTime: row?.server_time?.toISOString() ?? null,
      };
    } catch (err) {
      return {
        configured: true,
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Gagal terhubung ke PlanetScale.",
      };
    } finally {
      if (connection) {
        try {
          await connection.end();
        } catch {
          // ignore close errors
        }
      }
    }
  },
});

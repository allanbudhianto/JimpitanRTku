"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { ROLES } from "./schema";
import mysql from "mysql2/promise";

/** Name of the MySQL table that stores the jimpitan recap. */
const REKAP_TABLE = "jimpitan_rekap";

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

/**
 * Export the full jimpitan recap into a MySQL table on PlanetScale.
 *
 * Creates the `jimpitan_rekap` table if it does not exist, then upserts one
 * row per warga per month (re-exporting overwrites previous values, so the
 * table always mirrors the current Convex data). Admin & pengurus only.
 */
export const exportRekap = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.PENGGURUS)) {
      throw new Error("Hanya admin atau pengurus yang dapat mengekspor rekap.");
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return {
        configured: false,
        ok: false,
        exported: 0,
        message: "DATABASE_URL belum diatur di Keys.",
      };
    }

    const rows = await ctx.runQuery(api.rekap.getRekapData);

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

      await connection.query(`
        CREATE TABLE IF NOT EXISTS ${REKAP_TABLE} (
          id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          warga_id VARCHAR(64) NOT NULL,
          nama VARCHAR(255) NOT NULL,
          no_rumah VARCHAR(32) NULL,
          alamat VARCHAR(255) NULL,
          bulan CHAR(7) NOT NULL,
          nominal INT NOT NULL,
          dicatat_oleh VARCHAR(255) NULL,
          dicatat_pada DATETIME NULL,
          catatan VARCHAR(255) NULL,
          UNIQUE KEY uq_warga_bulan (warga_id, bulan)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);

      // Upsert in chunks of 200 rows per statement.
      const CHUNK = 200;
      let exported = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ");
        const values: (string | number | Date | null)[] = [];
        for (const r of chunk) {
          values.push(
            r.wargaId,
            r.nama,
            r.noRumah || null,
            r.alamat || null,
            r.month,
            r.nominal,
            r.recordedByName || null,
            r.recordedAt ? new Date(r.recordedAt) : null,
            r.note || null,
          );
        }
        await connection.query(
          `INSERT INTO ${REKAP_TABLE}
            (warga_id, nama, no_rumah, alamat, bulan, nominal, dicatat_oleh, dicatat_pada, catatan)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
             nama = VALUES(nama),
             no_rumah = VALUES(no_rumah),
             alamat = VALUES(alamat),
             nominal = VALUES(nominal),
             dicatat_oleh = VALUES(dicatat_oleh),
             dicatat_pada = VALUES(dicatat_pada),
             catatan = VALUES(catatan)`,
          values,
        );
        exported += chunk.length;
      }

      const [[{ total }]] = await connection.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM ${REKAP_TABLE}`,
      );

      return {
        configured: true,
        ok: true,
        exported,
        total: Number(total),
        table: REKAP_TABLE,
        database: url.pathname.replace(/^\//, ""),
      };
    } catch (err) {
      return {
        configured: true,
        ok: false,
        exported: 0,
        message:
          err instanceof Error
            ? err.message
            : "Gagal mengekspor rekap ke PlanetScale.",
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

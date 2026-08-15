import { query } from "./_generated/server";
import { ROLES } from "./schema";
import { getCurrentUser } from "./users";

/**
 * Full per-warga payment recap, for export to PlanetScale.
 * Admin & pengurus only.
 */
export const getRekapData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || (user.role !== ROLES.ADMIN && user.role !== ROLES.PENGGURUS)) {
      throw new Error("Hanya admin atau pengurus yang dapat mengakses rekap.");
    }

    const [payments, users] = await Promise.all([
      ctx.db.query("jimpitan").collect(),
      ctx.db.query("users").collect(),
    ]);
    const wargaMap = new Map(users.map((u) => [u._id, u]));

    const rows = payments.map((p) => {
      const warga = wargaMap.get(p.wargaId);
      const recorder = wargaMap.get(p.recordedById);
      return {
        wargaId: p.wargaId,
        nama: warga?.name ?? "Tanpa nama",
        month: p.month,
        nominal: p.nominal,
        recordedByName: recorder?.name ?? "Pengurus",
        recordedAt: p._creationTime,
        note: p.note ?? "",
      };
    });

    rows.sort((a, b) =>
      b.month === a.month
        ? a.nama.localeCompare(b.nama, "id")
        : b.month.localeCompare(a.month),
    );
    return rows;
  },
});

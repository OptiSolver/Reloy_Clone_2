export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db, branches, staff, eq, inArray } from "@loop/db";

/**
 * GET /api/staff?merchant_id=...
 */
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const merchant_id = url.searchParams.get("merchant_id");

        if (!merchant_id) {
            return NextResponse.json(
                { ok: false, error: "merchant_id requerido" },
                { status: 400 }
            );
        }

        // Obtenemos staff y completamos el nombre de la branch si es posible
        // Por simplicidad, primero obtenemos branches para mapear
        const branchList = await db
            .select()
            .from(branches)
            .where(eq(branches.merchantId, merchant_id));

        const branchMap = new Map(branchList.map(b => [b.id, b.name]));

        // Ahora obtenemos staff asociado a estas branches

        // Obtenemos todos los branch IDs del merchant
        const branchIds = branchList.map(b => b.id);

        if (branchIds.length === 0) {
            return NextResponse.json({ ok: true, staff: [] });
        }

        // Buscamos staff en esas branches
        const staffMembers = await db
            .select()
            .from(staff)
            .where(inArray(staff.branchId, branchIds));

        // Mapeamos para devolver un objeto más completo con branchName
        const staffWithBranch = staffMembers.map(s => ({
            ...s,
            branchName: branchMap.get(s.branchId) || "Sin sucursal"
        }));

        return NextResponse.json({
            ok: true,
            staff: staffWithBranch,
        });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : JSON.stringify(error);
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { pool, ensureSchema } from "@/lib/db";

// GET /api/shared-assets/check?assetType=character&sourceEntityId=123
// Returns whether this entity is currently shared
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const assetType = req.nextUrl.searchParams.get("assetType");
    const sourceEntityId = req.nextUrl.searchParams.get("sourceEntityId");

    if (!assetType || !sourceEntityId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `SELECT id FROM shared_assets WHERE asset_type = $1 AND source_entity_id = $2 LIMIT 1`,
      [assetType, Number(sourceEntityId)]
    );

    return NextResponse.json({ shared: rows.length > 0, sharedAssetId: rows[0]?.id || null });
  } catch {
    return NextResponse.json({ shared: false, sharedAssetId: null });
  }
}

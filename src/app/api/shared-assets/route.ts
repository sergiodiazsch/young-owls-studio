import { NextResponse } from "next/server";
import {
  shareAsset,
  unshareAsset,
  getSharedAsset,
  getAllSharedAssets,
} from "@/lib/db/queries";
import { safeJson } from "@/lib/api-utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? undefined;
    const assets = await getAllSharedAssets(type);
    return NextResponse.json(assets);
  } catch (err) {
    logger.error("GET /api/shared-assets error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to fetch shared assets" }, { status: 500 });
  }
}

interface ShareBody {
  assetType: string;
  sourceProjectId: number;
  sourceEntityId: number;
  name: string;
  description?: string;
  thumbnailPath?: string;
  metadata?: string;
}

export async function POST(req: Request) {
  try {
    const [body, err] = await safeJson<ShareBody>(req);
    if (err) return err;

    const { assetType, sourceProjectId, sourceEntityId, name } = body;
    if (!assetType || !sourceProjectId || !sourceEntityId || !name) {
      return NextResponse.json({ error: "assetType, sourceProjectId, sourceEntityId, and name required" }, { status: 400 });
    }

    const existing = await getSharedAsset(assetType, sourceEntityId);
    if (existing) {
      return NextResponse.json(existing);
    }

    const row = await shareAsset(body);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    logger.error("POST /api/shared-assets error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to share asset" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const assetType = searchParams.get("type");
    const entityId = Number(searchParams.get("entityId"));
    if (!assetType || isNaN(entityId)) {
      return NextResponse.json({ error: "type and entityId query params required" }, { status: 400 });
    }
    await unshareAsset(assetType, entityId);
    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error("DELETE /api/shared-assets error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to unshare asset" }, { status: 500 });
  }
}

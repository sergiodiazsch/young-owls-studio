import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  let dbOk = false;

  try {
    const result = await pool.query("SELECT 1 AS ok");
    dbOk = result.rows?.[0]?.ok === 1;
  } catch (err) {
    logger.error("Health check: database unreachable", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const status = dbOk ? "ok" : "degraded";
  const payload = {
    status,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "unknown",
    nodeVersion: process.version,
    uptime: Math.floor(process.uptime()),
    dbConnected: dbOk,
    responseTime: Date.now() - start,
  };

  if (status === "ok") {
    logger.info("Health check passed", payload);
  } else {
    logger.warn("Health check degraded", payload);
  }

  return NextResponse.json(payload, { status: dbOk ? 200 : 503 });
}

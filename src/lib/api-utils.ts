import { NextResponse } from "next/server";

/**
 * Safely parse JSON from a request body.
 * Returns [data, null] on success, [null, NextResponse] on failure.
 */
export async function safeJson<T = Record<string, unknown>>(
  req: Request
): Promise<[T, null] | [null, NextResponse]> {
  try {
    const data = await req.json();
    return [data as T, null];
  } catch {
    return [null, NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })];
  }
}

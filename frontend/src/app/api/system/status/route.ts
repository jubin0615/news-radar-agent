/**
 * BFF API Route — System status proxy
 * GET /api/system/status → Java backend GET /api/system/status
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function GET() {
  try {
    const res = await backendFetch("/api/system/status");

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

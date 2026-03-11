/**
 * BFF API Route — User data reset proxy
 * DELETE /api/system/reset → Java backend DELETE /api/system/reset
 */

import { backendFetch } from "@/lib/backend-fetch";

export const runtime = "nodejs";

export async function DELETE() {
  try {
    const res = await backendFetch("/api/system/reset", { method: "DELETE" });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

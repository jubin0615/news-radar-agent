/**
 * BFF API Route — Single keyword operations
 *
 * DELETE /api/keywords/[id]                   → backend DELETE /api/keywords/:id
 * PATCH  /api/keywords/[id]?status=PAUSED     → backend PATCH  /api/keywords/:id/status?status=PAUSED
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

/** 키워드 영구 삭제 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND_URL}/api/keywords/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

/**
 * 키워드 상태 변경
 * @param status ACTIVE | PAUSED | ARCHIVED
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  if (!status) {
    return Response.json({ error: "status parameter required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/keywords/${id}/status?status=${encodeURIComponent(status)}`,
      {
        method: "PATCH",
        headers: { Accept: "application/json" },
      },
    );

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

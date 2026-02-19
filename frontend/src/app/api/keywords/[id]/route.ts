/**
 * BFF API Route — Single keyword operations
 *
 * DELETE /api/keywords/[id]        → Java backend DELETE /api/keywords/:id
 * PUT    /api/keywords/[id]        → Java backend PUT    /api/keywords/:id/toggle
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

/** 키워드 삭제 */
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

/** 키워드 활성화/비활성화 토글 */
export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND_URL}/api/keywords/${id}/toggle`, {
      method: "PUT",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

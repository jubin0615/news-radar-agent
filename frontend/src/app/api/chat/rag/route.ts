/**
 * BFF API Route — RAG Chat proxy
 *
 * POST /api/chat/rag { question: string }
 * → Java backend POST /api/chat/rag
 * ← { answer: string, sources: RagSourceItem[] }
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const res = await fetch(`${BACKEND_URL}/api/chat/rag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      return Response.json({ error: `Backend ${res.status}` }, { status: res.status });
    }

    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "Backend unreachable" }, { status: 502 });
  }
}

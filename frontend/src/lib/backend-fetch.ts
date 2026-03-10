/**
 * BFF 라우트에서 백엔드로 요청할 때 사용하는 공통 fetch 유틸리티.
 *
 * - NextAuth 세션에서 backendToken을 추출하여 Authorization 헤더에 자동 주입
 * - 모든 BFF 라우트에서 이 함수를 사용하면 토큰 전달 로직이 한 곳에 집중됨
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

/**
 * 백엔드로 인증된 fetch 요청을 보낸다.
 * NextAuth 세션에서 backendToken을 추출하여 Authorization 헤더에 첨부.
 *
 * @param path  백엔드 경로 (예: "/api/keywords")
 * @param init  RequestInit (method, body 등)
 * @returns     fetch Response
 */
export async function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getServerSession(authOptions);
  const token = session?.backendToken;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

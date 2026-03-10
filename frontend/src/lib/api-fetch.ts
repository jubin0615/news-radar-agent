/**
 * 클라이언트 사이드 API fetch wrapper.
 *
 * - BFF 라우트(`/api/...`)를 호출할 때 사용
 * - 401 Unauthorized 응답 시 NextAuth signOut()을 호출하여 로그인 페이지로 리다이렉트
 * - 중복 로그아웃 방지: 한 번만 signOut() 호출
 */
import { signOut } from "next-auth/react";

let signingOut = false;

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  if (res.status === 401 && !signingOut) {
    signingOut = true;
    // 세션 만료 → 자동 로그아웃 후 로그인 페이지로 이동
    await signOut({ callbackUrl: "/login" });
  }

  return res;
}

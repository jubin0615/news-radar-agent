/**
 * NextAuth.js 설정 — Google + GitHub 소셜 로그인
 *
 * 핵심 흐름:
 *   1. 사용자가 소셜 로그인 완료
 *   2. signIn 콜백에서 백엔드 POST /api/auth/login 호출
 *   3. 백엔드에서 반환한 JWT를 NextAuth 토큰에 저장
 *   4. session 콜백에서 backendToken을 세션에 노출
 *   5. 프론트엔드에서 useSession()으로 토큰 접근
 */

import type { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8081";

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
  ],

  callbacks: {
    /**
     * JWT 콜백 — 소셜 로그인 성공 직후(account !== null) 백엔드에 사용자 등록/조회 요청.
     * 백엔드가 반환한 JWT를 NextAuth 토큰에 저장한다.
     */
    async jwt({ token, user, account, profile }) {
      // 최초 로그인 시에만 실행 (이후 세션 갱신 시에는 account가 null)
      if (account && user) {
        const provider = account.provider.toUpperCase(); // GOOGLE | GITHUB
        const providerId = account.providerAccountId;

        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              provider,
              providerId,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            token.backendToken = data.token;
            token.userId = String(data.user.id);
            token.role = data.user.role;
          } else {
            console.error("[NextAuth] Backend login failed:", res.status);
          }
        } catch (err) {
          console.error("[NextAuth] Backend login error:", err);
        }
      }

      return token;
    },

    /**
     * Session 콜백 — JWT 토큰의 backendToken을 세션에 전달.
     * 클라이언트에서 useSession().data.backendToken 으로 접근 가능.
     */
    async session({ session, token }) {
      if (token.backendToken) {
        session.backendToken = token.backendToken;
      }
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",  // 커스텀 로그인 페이지 (선택사항 — 없으면 기본 제공 페이지 사용)
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24시간 (백엔드 JWT 만료와 일치)
  },

  secret: process.env.NEXTAUTH_SECRET,
};

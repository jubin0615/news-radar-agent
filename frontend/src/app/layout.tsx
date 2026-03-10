import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CopilotKit } from "@copilotkit/react-core";
import AuthProvider from "@/components/providers/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "News Intelligence Radar",
  description: "AI-powered news intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* AuthProvider → CopilotKit: 모든 페이지에서 세션 + CopilotKit 사용 가능 */}
        <AuthProvider>
          <CopilotKit runtimeUrl="/api/copilotkit" useSingleEndpoint agent="default">
            {children}
          </CopilotKit>
        </AuthProvider>
      </body>
    </html>
  );
}

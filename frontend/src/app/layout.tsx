import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CopilotKit } from "@copilotkit/react-core";
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
        {/* CopilotKit provider: 모든 페이지에서 useCopilotAction / useCopilotChat 사용 가능 */}
        <CopilotKit runtimeUrl="/api/copilotkit" useSingleEndpoint agent="default">
          {children}
        </CopilotKit>
      </body>
    </html>
  );
}

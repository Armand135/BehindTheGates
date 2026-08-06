import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Port Operations Copilot",
  description: "Container terminal digital twin, optimization, and AI copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <span className="brand">⚓ Port Ops Copilot</span>
          <Link href="/">Dashboard</Link>
          <Link href="/twin">Digital Twin</Link>
          <Link href="/optimization">Optimization</Link>
          <Link href="/copilot">Copilot</Link>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}

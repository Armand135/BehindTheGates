import type { Metadata } from "next";
import AuthGate from "@/components/AuthGate";
import Nav from "@/components/Nav";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Port Operations Copilot",
  description: "Container terminal digital twin, optimization, and AI copilot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Nav />
          <main>
            <AuthGate>{children}</AuthGate>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

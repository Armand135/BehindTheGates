import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Behind The Gates",
  description:
    "Book guided visits inside real, working companies — factories, refineries, ports — the way you'd book a museum ticket.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-brand-50 text-brand-900 antialiased">
        <Providers>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}

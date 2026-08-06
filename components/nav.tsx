"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

export function Nav() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-brand-100 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-brand-800">
          Behind The Gates
        </Link>
        <div className="flex items-center gap-6 text-sm text-brand-700">
          <Link href="/listings">Browse visits</Link>
          {session?.user?.role === "host_admin" || session?.user?.role === "guide" ? (
            <Link href="/host/dashboard">Host dashboard</Link>
          ) : null}
          {session?.user?.role === "platform_admin" ? <Link href="/admin/listings">Admin</Link> : null}
          {session?.user ? (
            <button onClick={() => signOut()} className="text-brand-600 hover:underline">
              Sign out
            </button>
          ) : (
            <Link href="/login" className="rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

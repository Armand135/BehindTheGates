import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe subset of the NextAuth config: no Prisma adapter, no
 * Credentials/bcrypt provider (those need the Node.js runtime). This is
 * what middleware.ts loads, since Next.js middleware runs on the Edge
 * runtime by default. The full config (auth.ts) extends this with the
 * adapter and providers for use in route handlers / server components.
 */
export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;

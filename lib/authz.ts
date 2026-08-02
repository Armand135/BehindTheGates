import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new AuthError("Authentication required.", 401);
  }
  return session;
}

export async function requireRole(...roles: UserRole[]) {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) {
    throw new AuthError(`Requires one of role(s): ${roles.join(", ")}.`, 403);
  }
  return session;
}

/**
 * Confirms the current user is an admin/owner member of the given
 * HostOrganization, or a platform_admin (who may act on any org). Used to
 * gate all /host-organizations/:id/* and listing-mutation routes.
 */
export async function requireHostOrgMember(hostOrganizationId: string) {
  const session = await requireSession();
  if (session.user.role === "platform_admin") return session;

  const membership = await prisma.hostOrganizationMember.findUnique({
    where: {
      hostOrganizationId_userId: {
        hostOrganizationId,
        userId: session.user.id,
      },
    },
  });
  if (!membership) {
    throw new AuthError("You are not a member of this host organization.", 403);
  }
  return session;
}

/** Uniform error -> NextResponse mapping for route handlers. */
export function authErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return null;
}

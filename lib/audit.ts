import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

/**
 * Append-only audit trail (Technical Brief Section 8): every listing
 * approval, waiver signature, and refund must be logged with actor +
 * timestamp for insurance/legal defensibility.
 */
export async function logAudit(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

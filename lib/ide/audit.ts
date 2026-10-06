import { prisma } from "@/lib/db";

export type IdeAuditAction =
  | "unlock"
  | "unlock_failed"
  | "save"
  | "create"
  | "delete"
  | "restore"
  | "zip_download"
  | "zip_apply"
  | "deploy"
  | "sync_push"
  | "sync_pull";

/** هر عمل ابزار توسعه ثبت می‌شود؛ شکست ثبت نباید عملیات اصلی را خراب کند، ولی در لاگ می‌ماند. */
export async function ideAudit(adminId: string, action: IdeAuditAction, path?: string, detail?: string) {
  try {
    await prisma.ideAuditLog.create({ data: { adminId, action, path: path ?? null, detail: detail ?? null } });
  } catch (error) {
    console.error("[ide-audit] ثبت رویداد ناموفق بود:", error);
  }
}

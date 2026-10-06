import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, adminErrorUpdateInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function guard(): Promise<NextResponse | null> {
  try {
    await requireAdmin();
    return null;
  } catch (error) {
    if (error instanceof SessionError) return NextResponse.json({ error: error.message }, { status: 403 });
    throw error;
  }
}

// GET /api/admin/errors/:id — جزئیات کامل یک خطا (استک، مکان، کاربر آخر)
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;

  const row = await prisma.errorLog.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: "خطا پیدا نشد." }, { status: 404 });

  const user = row.lastUserId
    ? await prisma.user.findUnique({ where: { id: row.lastUserId }, select: { id: true, mobile: true, name: true } })
    : null;

  return NextResponse.json({
    error: {
      ...row,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      lastUser: user,
    },
  });
}

// PATCH /api/admin/errors/:id { status } — حل‌شده/بازکردن
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;

  let input;
  try {
    input = validateInput(adminErrorUpdateInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const result = await prisma.errorLog.updateMany({
    where: { id: params.id },
    data: { status: input.status, resolvedAt: input.status === "resolved" ? new Date() : null },
  });
  if (result.count === 0) return NextResponse.json({ error: "خطا پیدا نشد." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/errors/:id — حذف یک ردیف لاگ
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  await prisma.errorLog.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

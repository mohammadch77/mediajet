import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, setUserStatusInput } from "@/lib/validation";

// POST /api/admin/users/:id/status  { disabled: boolean, reason?: string }
// غیرفعال/فعال‌سازی کاربر؛ فقط admin. غیرفعال‌سازی همه‌ی نشست‌های کاربر را همان لحظه باطل می‌کند.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  if (admin.id === params.id) {
    return NextResponse.json({ error: "نمی‌توانید حساب خودتان را غیرفعال کنید." }, { status: 400 });
  }

  let input;
  try {
    input = validateInput(setUserStatusInput, await req.json());
  } catch (error) {
    const message = error instanceof ValidationError ? error.message : "بدنه‌ی درخواست نامعتبر است.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
  }
  if (target.role === "admin" && input.disabled) {
    return NextResponse.json({ error: "ابتدا نقش این مدیر را تغییر دهید، بعد غیرفعالش کنید." }, { status: 400 });
  }
  if (!!target.disabledAt === input.disabled) {
    return NextResponse.json(
      { error: input.disabled ? "این کاربر از قبل غیرفعال است." : "این کاربر از قبل فعال است." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: target.id },
      data: input.disabled
        ? { disabledAt: new Date(), disabledReason: input.reason || null }
        : { disabledAt: null, disabledReason: null },
    });
    if (input.disabled) {
      await tx.session.deleteMany({ where: { userId: target.id } });
    }
  });

  return NextResponse.json({ ok: true, disabled: input.disabled });
}

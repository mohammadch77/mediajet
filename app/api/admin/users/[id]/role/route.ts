import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, SessionError } from "@/lib/session";
import { validateInput, ValidationError, changeUserRoleInput } from "@/lib/validation";

// POST /api/admin/users/:id/role
// تغییر نقش کاربر؛ فقط admin. تغییر در یک تراکنش اتمیک انجام و در RoleChangeLog ثبت می‌شود.
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
    return NextResponse.json({ error: "نمی‌توانید نقش خودتان را تغییر دهید." }, { status: 400 });
  }

  let input;
  try {
    const body = await req.json();
    input = validateInput(changeUserRoleInput, body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "بدنه‌ی درخواست نامعتبر است." }, { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({ where: { id: params.id } });
  if (!targetUser) {
    return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
  }

  if (targetUser.role === input.role) {
    return NextResponse.json({ error: "کاربر همین حالا هم همین نقش را دارد." }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: targetUser.id }, data: { role: input.role } });
    await tx.roleChangeLog.create({
      data: {
        targetUserId: targetUser.id,
        fromRole: targetUser.role,
        toRole: input.role,
        changedById: admin.id,
      },
    });
    return user;
  });

  return NextResponse.json({ user: { id: updated.id, role: updated.role } });
}

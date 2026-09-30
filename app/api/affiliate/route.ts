import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getAffiliateDashboard, getProgramInfo } from "@/lib/affiliateSummary";

// GET /api/affiliate
// اطلاعات عمومی برنامه (درصد و حداقل تسویه) + اگر کاربر وارد شده، داشبورد همکاری خودش.
export async function GET() {
  const [program, user] = await Promise.all([getProgramInfo(), getCurrentUser()]);
  if (!user) {
    return NextResponse.json({ program, loggedIn: false, dashboard: null });
  }
  const dashboard = await getAffiliateDashboard(user.id);
  return NextResponse.json({ program, loggedIn: true, dashboard });
}

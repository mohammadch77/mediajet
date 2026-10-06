import { NextRequest, NextResponse } from "next/server";
import { ideGuard, ideErrorResponse } from "@/lib/ide/guard";
import { listTree } from "@/lib/ide/files";

// GET /api/admin/ide/tree?path= — محتوای یک پوشه (یک سطح).
export async function GET(req: NextRequest) {
  const guard = await ideGuard();
  if (guard.response) return guard.response;
  try {
    return NextResponse.json({ entries: await listTree(req.nextUrl.searchParams.get("path") ?? "") });
  } catch (error) {
    return ideErrorResponse(error);
  }
}

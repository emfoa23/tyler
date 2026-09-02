import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/ops";

export const dynamic = "force-dynamic";

// sync-draw 워크플로가 신규 회차 반영 후 호출한다.
export async function POST(req: Request) {
  if (!checkCronSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidatePath("/");
  revalidatePath("/history");
  revalidatePath("/stores");
  revalidatePath("/numbers");
  revalidatePath("/numbers/missing");
  revalidatePath("/history/[draw]", "page");
  revalidatePath("/stores/[id]", "page");
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}

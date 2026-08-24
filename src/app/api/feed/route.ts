import { isValidCursor, readFeed } from "@/lib/feed";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const after = new URL(req.url).searchParams.get("after");
  if (!isValidCursor(after)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }
  try {
    return NextResponse.json(await readFeed({ after }));
  } catch {
    return NextResponse.json({ error: "Feed unavailable" }, { status: 503 });
  }
}

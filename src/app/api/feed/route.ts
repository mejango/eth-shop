import { readFeed } from "@/lib/feed";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const after = new URL(req.url).searchParams.get("after");
  return NextResponse.json(await readFeed({ after }));
}

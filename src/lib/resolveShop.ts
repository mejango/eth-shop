import "server-only";
import { cache } from "react";
import { resolveHandle } from "./handles";
import { parseSlug } from "./slug";

export const resolveShopRoute = cache(async (handle: string) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(handle);
  } catch {
    return null;
  }
  if (decoded === "demo") return { demo: true as const };
  return parseSlug(decoded) ?? (await resolveHandle(decoded));
});

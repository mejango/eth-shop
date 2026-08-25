import { twMerge } from "tailwind-merge";

export type ClassValue =
  string | number | boolean | null | undefined | ClassValue[] | { [className: string]: unknown };

function joinClassValues(value: ClassValue): string {
  if (!value) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(joinClassValues).filter(Boolean).join(" ");
  return Object.entries(value)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([className]) => className)
    .join(" ");
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(joinClassValues).filter(Boolean).join(" "));
}

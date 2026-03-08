import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function humanizeUiLabel(value: string | null | undefined) {
  if (!value) return ""

  const normalized = value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

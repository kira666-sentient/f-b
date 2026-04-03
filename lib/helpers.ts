import type { Profile, SharedItem } from "./app-types";
import type { User } from "@supabase/supabase-js";

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short"
});

const dateOnlyFmt = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium"
});

export function formatCurrency(amountInPaise: number) {
  return money.format(amountInPaise / 100);
}

export function formatDate(value: string | null) {
  if (!value) return "No due date";
  return dateTimeFmt.format(new Date(value));
}

export function formatDateOnly(d: Date) {
  return dateOnlyFmt.format(d);
}

export function formatDateTime(d: Date) {
  return dateTimeFmt.format(d);
}

export function formatUsernameCandidate(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

export function makeStarterUsername(user: User) {
  const emailPart = user.email?.split("@")[0] ?? "friend";
  const base = formatUsernameCandidate(emailPart) || "friend";
  const suffix = user.id.replace(/-/g, "").slice(0, 4);
  return `${base}_${suffix}`;
}

export function readableProfile(profile?: Profile | null) {
  return profile?.full_name || profile?.username || "Friend";
}

export function initialsFor(profile?: Profile | null) {
  const source = readableProfile(profile).trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "FB";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function getErrorMessage(cause: unknown) {
  if (typeof cause === "string") return cause;
  if (cause instanceof Error) return cause.message;
  return "Something went wrong. Please try again.";
}

export function getSharedItemBorrowerId(item: SharedItem) {
  return item.type === "gave" ? item.friend_id : item.owner_id;
}

export function getSharedItemPhysicalOwnerId(item: SharedItem) {
  return item.type === "gave" ? item.owner_id : item.friend_id;
}

export function getSharedItemRequesterId(item: SharedItem) {
  return item.status === "pending_return" ? getSharedItemBorrowerId(item) : item.owner_id;
}

export function getSharedItemCounterpartyId(item: SharedItem, userId: string) {
  return item.owner_id === userId ? item.friend_id : item.owner_id;
}

export function isSharedItemBorrower(item: SharedItem, userId: string) {
  return getSharedItemBorrowerId(item) === userId;
}

export function canApproveSharedItem(item: SharedItem, userId: string) {
  if (item.status === "pending") return item.friend_id === userId;
  if (item.status === "pending_return") return getSharedItemPhysicalOwnerId(item) === userId;
  return false;
}

import { Timestamp } from "firebase/firestore";

/**
 * A createdAt as it arrives from Firestore: already converted to a Date by a
 * service mapper, or still a Timestamp when it came straight off a snapshot.
 * Optimistic values written client-side are plain Dates.
 */
export type FirestoreDate = Date | Timestamp | null | undefined;

const toDate = (value: FirestoreDate): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  return null;
};

/**
 * "Just now", "5m", "3h", "2d", then an absolute date past a week.
 * `suffix` appends " ago" — the entry header wants it, the denser reply row
 * does not.
 */
export const formatRelativeTime = (
  value: FirestoreDate,
  { suffix = false }: { suffix?: boolean } = {},
): string => {
  const date = toDate(value);
  if (!date) return "Just now";

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const tail = suffix ? " ago" : "";

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m${tail}`;
  if (diffHours < 24) return `${diffHours}h${tail}`;
  if (diffDays < 7) return `${diffDays}d${tail}`;
  return date.toLocaleDateString();
};

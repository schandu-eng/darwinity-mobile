const DAY_MS = 24 * 60 * 60 * 1000;

export function getActivityAt(item: { last_opened_at?: string | null; created_at?: string | null }) {
  const raw = item?.last_opened_at || item?.created_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatActivityRelative(dateString: string | null | undefined) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 172800) return 'Yesterday';
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function groupNotesByActivityDate<T extends { last_opened_at?: string | null; created_at?: string | null }>(
  items: T[]
) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday.getTime() - 6 * DAY_MS);

  const buckets: { id: string; label: string; items: T[] }[] = [
    { id: 'today', label: 'Today', items: [] },
    { id: 'previous-7-days', label: 'Previous 7 days', items: [] },
    { id: 'older', label: 'Older', items: [] },
  ];

  for (const item of items) {
    const activityAt = getActivityAt(item);
    if (!activityAt || activityAt >= startOfToday) {
      buckets[0].items.push(item);
    } else if (activityAt >= startOfWeek) {
      buckets[1].items.push(item);
    } else {
      buckets[2].items.push(item);
    }
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
}

export function activityLabelForItem(item: { last_opened_at?: string | null; created_at?: string | null }) {
  if (item?.last_opened_at) {
    return { verb: 'Opened', at: item.last_opened_at };
  }
  return { verb: 'Created', at: item?.created_at ?? null };
}

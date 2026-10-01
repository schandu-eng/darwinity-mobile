export function shuffleCopy<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleIds(ids: string[]): string[] {
  return shuffleCopy(ids);
}

export function shuffleIdsKeepingFirst(ids: string[], firstId: string | null): string[] {
  if (!ids?.length) return [];
  if (!firstId || !ids.includes(firstId)) return shuffleIds(ids);
  const rest = ids.filter((id) => id !== firstId);
  return [firstId, ...shuffleCopy(rest)];
}

export function orderCardsByIds<T>(
  cards: T[],
  idOrder: string[],
  keyFn: (card: T, index: number) => string = (c: any, i) => c?.id ?? `i:${i}`
): T[] {
  const byKey = new Map(cards.map((c, i) => [keyFn(c, i), c]));
  return idOrder.map((key) => byKey.get(key)).filter((c): c is T => Boolean(c));
}

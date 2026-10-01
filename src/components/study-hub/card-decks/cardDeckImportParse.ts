export const TERM_SEP_PRESETS = [
  { id: 'tab', label: 'Tab', value: '\t' },
  { id: 'comma', label: 'Comma', value: ',' },
  { id: 'custom', label: 'Custom', value: null },
] as const;

export const CARD_SEP_PRESETS = [
  { id: 'newline', label: 'New line', value: '\n' },
  { id: 'semicolon', label: 'Semicolon', value: ';' },
  { id: 'custom', label: 'Custom', value: null },
] as const;

export const MAX_IMPORT_CARDS = 500;

export type SepPresetId = 'tab' | 'comma' | 'custom' | 'newline' | 'semicolon';

function escapeRegExp(value: string) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveSeparator(
  presetId: string,
  customValue: string,
  presets: ReadonlyArray<{ id: string; value: string | null }>
): string | null {
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) return null;
  if (preset.value != null) return preset.value;
  const custom = String(customValue ?? '');
  if (!custom.length) return null;
  return custom;
}

export function parseQuizletImport(
  text: string,
  {
    termSepId = 'tab',
    termCustom = '',
    cardSepId = 'newline',
    cardCustom = '',
    maxCards = MAX_IMPORT_CARDS,
  }: {
    termSepId?: string;
    termCustom?: string;
    cardSepId?: string;
    cardCustom?: string;
    maxCards?: number;
  } = {}
): { cards: Array<{ front: string; back: string }>; skipped: number; error: string | null } {
  const raw = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!raw.trim()) {
    return { cards: [], skipped: 0, error: null };
  }

  const termSep = resolveSeparator(termSepId, termCustom, TERM_SEP_PRESETS);
  const cardSep = resolveSeparator(cardSepId, cardCustom, CARD_SEP_PRESETS);

  if (!termSep) {
    return { cards: [], skipped: 0, error: 'Choose a term / definition separator.' };
  }
  if (!cardSep) {
    return { cards: [], skipped: 0, error: 'Choose a between-cards separator.' };
  }
  if (termSep === cardSep) {
    return {
      cards: [],
      skipped: 0,
      error: 'Term and card separators must be different.',
    };
  }

  const chunks =
    cardSep === '\n' ? raw.split('\n') : raw.split(new RegExp(escapeRegExp(cardSep)));

  const cards: Array<{ front: string; back: string }> = [];
  let skipped = 0;

  for (const chunk of chunks) {
    const piece = chunk.trim();
    if (!piece) continue;

    const idx = piece.indexOf(termSep);
    if (idx === -1) {
      skipped += 1;
      continue;
    }
    const front = piece.slice(0, idx).trim();
    const back = piece.slice(idx + termSep.length).trim();
    if (!front || !back) {
      skipped += 1;
      continue;
    }

    cards.push({ front, back });
    if (cards.length >= maxCards) break;
  }

  return { cards, skipped, error: null };
}

export function importPlaceholderExample(termSepId = 'tab') {
  if (termSepId === 'comma') {
    return 'Term 1, Definition 1\nTerm 2, Definition 2\nTerm 3, Definition 3';
  }
  if (termSepId === 'custom') {
    return 'Term 1 - Definition 1\nTerm 2 - Definition 2\nTerm 3 - Definition 3';
  }
  return 'Term 1\tDefinition 1\nTerm 2\tDefinition 2\nTerm 3\tDefinition 3';
}

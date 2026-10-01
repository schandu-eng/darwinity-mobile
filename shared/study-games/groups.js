/** Shared multiple-choice item building for study games. */

export const MIN_GAME_HIGHLIGHTS = 2;
export const MIN_GAME_ITEMS = MIN_GAME_HIGHLIGHTS;
export const MAX_CHOICE_CHARS = 72;
export const MAX_PROMPT_CHARS = 160;

const FALLBACK_DECOYS = [
  'Not this one',
  'Something else',
  'A different idea',
];

export function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[j], next[i]] = [next[i], next[j]];
  }
  return next;
}

export function normalizeSpace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

export function stripStudyMarkdown(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[\[([^\]\n]+?)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~]+/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shortenChoice(text, max = MAX_CHOICE_CHARS) {
  const s = normalizeSpace(text);
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function trimClozePrompt(prompt, max = MAX_PROMPT_CHARS) {
  const s = normalizeSpace(prompt);
  if (s.length <= max) return s;
  const blankAt = s.indexOf('_____');
  if (blankAt < 0) return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
  const room = Math.max(24, Math.floor((max - 5) / 2));
  const start = Math.max(0, blankAt - room);
  const end = Math.min(s.length, blankAt + 5 + room);
  let out = s.slice(start, end).trim();
  if (start > 0) out = `…${out}`;
  if (end < s.length) out = `${out}…`;
  return out;
}

function uniqueAnswers(answers) {
  const seen = new Set();
  const out = [];
  answers.forEach((a) => {
    const key = a.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(a);
  });
  return out;
}

function choiceLabels(answer, distractors, choiceCount) {
  const raw = [answer, ...distractors].slice(0, choiceCount);
  if (!raw.includes(answer)) raw[0] = answer;
  return shuffle(raw);
}

/**
 * Attach multiple-choice options to prompt/answer groups.
 * @param {{ id: string, prompt: string, answer: string }[]} groups
 */
export function buildGameItemsFromGroups(groups, { choiceCount = 3 } = {}) {
  const list = Array.isArray(groups) ? groups.filter((g) => g?.answer) : [];
  const pool = uniqueAnswers(list.map((g) => g.answer));

  return list.map((g) => {
    const distractors = shuffle(
      pool.filter((a) => a.toLowerCase() !== g.answer.toLowerCase()),
    ).slice(0, Math.max(0, choiceCount - 1));

    let decoyIdx = 0;
    while (distractors.length < choiceCount - 1) {
      const filler = pool.find(
        (a) =>
          a.toLowerCase() !== g.answer.toLowerCase()
          && !distractors.some((d) => d.toLowerCase() === a.toLowerCase()),
      );
      if (filler) {
        distractors.push(filler);
        continue;
      }
      const decoy = FALLBACK_DECOYS[decoyIdx % FALLBACK_DECOYS.length];
      decoyIdx += 1;
      if (!distractors.includes(decoy) && decoy.toLowerCase() !== g.answer.toLowerCase()) {
        distractors.push(decoy);
        continue;
      }
      break;
    }

    const choices = choiceLabels(g.answer, distractors, Math.max(1, choiceCount));
    return {
      id: g.id,
      prompt: g.prompt,
      answer: g.answer,
      choices,
      choiceLabels: choices.map((c) => shortenChoice(c)),
    };
  });
}

export function pickRoundItems(items, count = 12) {
  return shuffle(items).slice(0, Math.min(count, items.length));
}

/** Map LLM (or other) prompt/answer/choices payloads into playable game items. */
export function normalizeGeneratedGameItems(items, { choiceCount = 3 } = {}) {
  const groups = (Array.isArray(items) ? items : [])
    .map((item, index) => {
      const prompt = normalizeSpace(item?.prompt);
      const answer = normalizeSpace(item?.answer);
      if (!prompt || !answer) return null;
      const provided = (Array.isArray(item.choices) ? item.choices : [])
        .map((c) => normalizeSpace(c))
        .filter(Boolean);
      return {
        id: item.id != null ? String(item.id) : `gen_${index}`,
        prompt: trimClozePrompt(prompt),
        answer: shortenChoice(answer),
        provided,
      };
    })
    .filter(Boolean);

  if (!groups.length) return [];

  const withChoices = groups.filter((g) => g.provided.length >= 2);
  if (withChoices.length === groups.length) {
    return groups.map((g) => {
      let choices = [...g.provided];
      if (!choices.some((c) => c.toLowerCase() === g.answer.toLowerCase())) {
        choices = [g.answer, ...choices];
      }
      choices = shuffle(choices).slice(0, Math.max(2, choiceCount));
      if (!choices.some((c) => c.toLowerCase() === g.answer.toLowerCase())) {
        choices[0] = g.answer;
      }
      return {
        id: g.id,
        prompt: g.prompt,
        answer: g.answer,
        choices,
        choiceLabels: choices.map((c) => shortenChoice(c)),
      };
    });
  }

  return buildGameItemsFromGroups(
    groups.map(({ id, prompt, answer }) => ({ id, prompt, answer })),
    { choiceCount },
  );
}

/**
 * Podcast transcript helpers (native-only).
 * Mirrors the web `transcriptUtils` behavior closely enough for UI parity.
 *
 * We expect `rawScript` to be either:
 * - a string with speaker cues like "Host 1: ...", "Speaker 2: ..."
 * - or an already-normalized structure (we try to handle both).
 */

export type PodcastTurn = {
  speaker: 'host1' | 'host2';
  text: string;
  start?: number;
  end?: number;
};

export type PodcastHosts = { host1: string; host2: string };

export type PodcastTranscript = {
  hosts: PodcastHosts;
  turns: Array<PodcastTurn & { start: number; end: number }>;
};

export const DEFAULT_PODCAST_HOSTS = {
  host1: 'Alex',
  host2: 'Sam',
} as const;

function isTtsVoiceIdLabel(name: unknown) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /neural\d|wavenet|chirp/i.test(trimmed) || /^[a-z]{2}-[A-Z]{2}-/i.test(trimmed);
}

export function sanitizePodcastHosts(hosts: any): PodcastHosts {
  const host1 =
    hosts?.host1 && !isTtsVoiceIdLabel(hosts.host1) ? hosts.host1 : DEFAULT_PODCAST_HOSTS.host1;
  const host2 =
    hosts?.host2 && !isTtsVoiceIdLabel(hosts.host2) ? hosts.host2 : DEFAULT_PODCAST_HOSTS.host2;
  return { host1, host2 };
}

export function parsePodcastScriptTurns(script: any): Array<{ speaker: string; text: string }> {
  if (!script || typeof script !== 'string') return [];

  const normalizedScript = script
    .replace(
      /\s*((?:Host\s*[12]|Speaker\s*[12]|Alex|Sam)\s*:)/gi,
      '\n$1',
    )
    .trim();

  const lines = normalizedScript
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const turns: Array<{ speaker: string; text: string }> = [];
  let currentSpeaker: string | null = null;
  let currentText: string[] = [];

  const flush = () => {
    if (!currentSpeaker || currentText.length === 0) return;
    const merged = currentText.join(' ').trim();
    if (!merged) return;
    turns.push({ speaker: currentSpeaker, text: merged });
  };

  const speakerFromLabel = (label: string) => {
    const normalized = label.replace(/\s+/g, '').toLowerCase();
    if (
      normalized === 'host1' ||
      normalized === 'hostone' ||
      normalized === 'speaker1' ||
      normalized === 'alex'
    ) {
      return 'host1';
    }
    if (
      normalized === 'host2' ||
      normalized === 'hosttwo' ||
      normalized === 'speaker2' ||
      normalized === 'sam'
    ) {
      return 'host2';
    }
    return turns.length % 2 === 0 ? 'host1' : 'host2';
  };

  for (const line of lines) {
    const labeled = line.match(/^((?:Host\s*[12]|Speaker\s*[12]|[A-Za-z][A-Za-z .'-]{0,24}))\s*:\s*(.*)$/i);
    if (labeled) {
      flush();
      currentSpeaker = speakerFromLabel(labeled[1]);
      currentText = [labeled[2].trim()].filter(Boolean);
      continue;
    }
    if (currentSpeaker) {
      currentText.push(line);
    } else {
      currentSpeaker = turns.length % 2 === 0 ? 'host1' : 'host2';
      currentText = [line];
    }
  }

  flush();

  if (turns.length > 1) return turns;
  if (turns.length === 1 && !/:\s*/.test(turns[0].text)) return turns;

  // Fallback: paragraph split
  const paragraphs = String(script).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map((text: string, index: number) => ({
      speaker: index % 2 === 0 ? 'host1' : 'host2',
      text,
    }));
  }

  // Fallback: chunk sentences
  const sentences = String(script)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) {
    return turns.length ? turns : [{ speaker: 'host1', text: String(script).trim() }];
  }

  const chunked: Array<{ speaker: string; text: string }> = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunked.push({
      speaker: chunked.length % 2 === 0 ? 'host1' : 'host2',
      text: sentences.slice(i, i + 2).join(' '),
    });
  }
  return chunked;
}

export function estimateTurnTimings(turns: Array<{ speaker: string; text: string }>, totalDuration: number) {
  if (!turns?.length || !totalDuration) {
    return turns?.map((turn) => ({ ...turn, start: 0, end: 0 })) || [];
  }

  const weights = turns.map((turn) => Math.max(turn.text?.length || 1, 1));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  let cursor = 0;

  return turns.map((turn, index) => {
    const segmentDuration = (weights[index] / totalWeight) * totalDuration;
    const timed = {
      ...turn,
      start: cursor,
      end: cursor + segmentDuration,
    };
    cursor += segmentDuration;
    return timed;
  });
}

export function normalizePodcastScript(podcastScript: any, rawScript: any, totalDuration: number): PodcastTranscript | null {
  // Structured podcast conversation (`{ hosts, turns }`) — same gate as web.
  if (podcastScript?.turns?.length > 1) {
    const hosts = sanitizePodcastHosts(podcastScript.hosts);
    const turns = podcastScript.turns || [];
    const estimated =
      turns[0]?.start != null && turns[0]?.end != null
        ? turns
        : estimateTurnTimings(turns, totalDuration);
    if (!estimated?.length) return null;
    return { hosts, turns: estimated };
  }

  const fallbackRaw =
    rawScript ||
    (podcastScript?.turns?.length === 1 ? String(podcastScript.turns[0]?.text || '') : '');
  if (!fallbackRaw) return null;

  const turns = estimateTurnTimings(parsePodcastScriptTurns(fallbackRaw), totalDuration);
  if (!turns.length) return null;

  return {
    hosts: sanitizePodcastHosts(podcastScript?.hosts) || DEFAULT_PODCAST_HOSTS,
    turns: turns as any,
  };
}

export function getActiveTurnIndex(turns: Array<any>, currentTime: number) {
  if (!turns?.length) return -1;
  const active = turns.findIndex((turn) => currentTime >= turn.start && currentTime < turn.end);
  if (active >= 0) return active;
  if (currentTime >= turns[turns.length - 1].end) {
    return turns.length - 1;
  }
  return -1;
}

export function getHostLabel(hosts: PodcastHosts, speaker: string) {
  const safe = sanitizePodcastHosts(hosts);
  if (speaker === 'host2') return safe.host2;
  return safe.host1;
}


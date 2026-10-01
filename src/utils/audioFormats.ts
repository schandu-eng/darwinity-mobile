export const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'webm'] as const;

export const AUDIO_PICKER_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
];

export const AUDIO_INPUT_ACCEPT = '.mp3,.m4a,.webm,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm';

export const ALLOWED_AUDIO_FORMATS_LABEL = 'MP3, M4A, or WebM';

export const isAllowedAudioExtension = (filename: string | undefined | null): boolean => {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return ALLOWED_AUDIO_EXTENSIONS.some((ext) => lower.endsWith(`.${ext}`));
};

export const getAudioMimeFromFilename = (filename: string | undefined | null): string | null => {
  if (!filename) return null;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return null;
};

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
];

export const pickSupportedRecorderMimeType = (): string => {
  const MediaRecorderCtor = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } }).MediaRecorder;
  if (!MediaRecorderCtor?.isTypeSupported) return '';
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorderCtor.isTypeSupported?.(type)) || '';
};

export const recordingFilenameForMime = (mimeType: string | undefined | null): string => {
  const lower = (mimeType || '').toLowerCase();
  const stamp = Date.now();
  if (lower.startsWith('audio/mp4')) return `recording_${stamp}.m4a`;
  if (lower.startsWith('audio/mpeg')) return `recording_${stamp}.mp3`;
  return `recording_${stamp}.webm`;
};

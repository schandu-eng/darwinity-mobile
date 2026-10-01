import { Linking, Platform } from 'react-native';
import { SITE_ORIGIN } from '@/utils/constants';

export const NATIVE_NOTES_EMBED_SOURCE = 'darwinity-notes-embed';

export const NATIVE_NOTES_EMBED_MESSAGE = {
  READY: 'notes-ready',
  DIRTY: 'notes-dirty',
  SAVED: 'notes-saved',
  SAVE_FAILED: 'notes-save-failed',
  AUTH_REQUIRED: 'notes-auth-required',
  NOT_FOUND: 'notes-not-found',
} as const;

export type NativeNotesEmbedMessageType =
  (typeof NATIVE_NOTES_EMBED_MESSAGE)[keyof typeof NATIVE_NOTES_EMBED_MESSAGE];

export type NativeNotesEmbedMessage = {
  source: string;
  type: NativeNotesEmbedMessageType | string;
};

const TOKEN_HASH_PREFIX = 'darwinityNativeToken=';

export function nativeNotesEmbedUrl(contentId: number, token?: string | null): string | null {
  const origin = (SITE_ORIGIN || '').replace(/\/$/, '');
  if (!origin || !contentId) return null;
  const url = `${origin}/embed/notes/${contentId}`;
  if (!token) return url;
  return `${url}#${TOKEN_HASH_PREFIX}${encodeURIComponent(token)}`;
}

/** Read-only notes viewer — same BlockNote layout as web, no editing chrome. */
export function nativeNotesViewEmbedUrl(contentId: number, token?: string | null): string | null {
  const origin = (SITE_ORIGIN || '').replace(/\/$/, '');
  if (!origin || !contentId) return null;
  let url = `${origin}/embed/notes/${contentId}?view=1`;
  if (token) url += `#${TOKEN_HASH_PREFIX}${encodeURIComponent(token)}`;
  return url;
}

export function nativeNotesWebEditorUrl(contentId: number): string | null {
  const origin = (SITE_ORIGIN || '').replace(/\/$/, '');
  if (!origin || !contentId) return null;
  return `${origin}/study/${contentId}/notes`;
}

export function tokenInjectScript(token: string): string {
  const encoded = JSON.stringify(token);
  return `(function(){try{var t=${encoded};if(t){localStorage.setItem('userToken',t);localStorage.setItem('token',t);}}catch(e){}true;})();`;
}

export const FLUSH_NOTES_SAVE_SCRIPT =
  'try{window.__darwinityNativeFlushSave&&window.__darwinityNativeFlushSave();}catch(e){}true;';

export function parseNativeNotesEmbedMessage(raw: string): NativeNotesEmbedMessage | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as NativeNotesEmbedMessage;
    if (!parsed || parsed.source !== NATIVE_NOTES_EMBED_SOURCE || !parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedEmbedNavigation(url: string, siteOrigin: string): boolean {
  if (!url || url === 'about:blank' || url.startsWith('data:') || url.startsWith('blob:')) {
    return true;
  }
  try {
    const dest = new URL(url);
    const origin = new URL(siteOrigin);
    const destHost = dest.hostname.replace(/^www\./, '');
    const originHost = origin.hostname.replace(/^www\./, '');
    if (destHost !== originHost) return false;
    const path = dest.pathname || '';
    return path.startsWith('/embed/notes/') || path === '/embed' || path.startsWith('/embed/');
  } catch {
    return false;
  }
}

export async function openNotesEditorInBrowser(contentId: number): Promise<boolean> {
  const url = nativeNotesWebEditorUrl(contentId);
  if (!url) return false;
  if (Platform.OS === 'web') {
    if (typeof globalThis.open === 'function') {
      globalThis.open(url, '_blank');
      return true;
    }
  }
  const can = await Linking.canOpenURL(url);
  if (!can) return false;
  await Linking.openURL(url);
  return true;
}

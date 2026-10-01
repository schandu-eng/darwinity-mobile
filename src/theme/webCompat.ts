import { Platform, type ViewProps, type ViewStyle } from 'react-native';

/** Native driver is missing on RN-web; JS driver matches CSS transitions. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Tailwind `duration-150` — Dialog `animate-in` / `zoom-in-95`. */
export const DIALOG_OPEN_MS = 150;
export const DIALOG_CLOSE_MS = 150;
export const DIALOG_ZOOM_FROM = 0.95;

/** Tailwind `duration-300` — mobile drawer `transition-all duration-300`. */
export const DRAWER_MS = 300;

/** Web `MODAL_ELEVATED_SHADOW_CLASS`. */
export const MODAL_ELEVATED_SHADOW =
  '0 28px 80px -20px rgba(26,47,35,0.35)';

/** Web toolbar `shadow-sm` / `0 1px 2px rgba(26,47,35,0.04)`. */
export const TOOLBAR_SHADOW = '0 1px 2px rgba(26,47,35,0.04)';

type NativeShadow = {
  shadowColor: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
};

export function boxShadow(web: string, native: NativeShadow): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: web } as ViewStyle;
  }
  return native as ViewStyle;
}

type PointerEventsValue = NonNullable<ViewProps['pointerEvents']>;

/** RN-web wants this in `style`; native ignores it and needs the View prop. */
export function pointerEventsStyle(value: PointerEventsValue): ViewStyle {
  return { pointerEvents: value } as ViewStyle;
}

export function pointerEventsProp(value: PointerEventsValue): PointerEventsValue | undefined {
  return Platform.OS === 'web' ? undefined : value;
}

export const overlayBlurStyle: ViewStyle =
  Platform.OS === 'web'
    ? ({ backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' } as ViewStyle)
    : {};

/** Kill the UA blue focus ring on RN-web controls. Pair with a custom focused border. */
export const hideWebFocusRing: ViewStyle =
  Platform.OS === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' } as ViewStyle)
    : {};

export function injectWebFocusReset() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('dw-web-focus-reset')) return;
  const el = document.createElement('style');
  el.id = 'dw-web-focus-reset';
  el.textContent = [
    'textarea:focus, input:focus, [contenteditable]:focus,',
    'button:focus, [role="button"]:focus, [tabindex]:focus {',
    '  outline: none !important;',
    '}',
  ].join('\n');
  document.head.appendChild(el);
}

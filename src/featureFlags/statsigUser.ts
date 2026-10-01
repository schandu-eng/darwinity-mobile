import { getExtra } from '@/utils/constants';

export function buildStatsigUser(
  userId?: number | string | null,
  email?: string | null
) {
  return {
    userID: userId != null ? String(userId) : 'anonymous',
    ...(email ? { email } : {}),
  };
}

export function getStatsigClientKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_STATSIG_CLIENT_KEY?.trim();
  if (fromEnv) return fromEnv;
  return getExtra().statsigClientKey?.trim() || undefined;
}

export function getEnvGateOverride(gateName: string): boolean {
  if (gateName === 'flowchart') {
    if (process.env.EXPO_PUBLIC_STATSIG_FLOWCHART_ENABLED === 'true') return true;
    if (process.env.EXPO_PUBLIC_STATSIG_FLOWCHART_ENABLED === 'false') return false;
    return Boolean(getExtra().statsigFlowchartEnabled);
  }

  return false;
}

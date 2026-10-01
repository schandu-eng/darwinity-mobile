import { useGateValue } from '@statsig/expo-bindings';
import { STATSIG_GATES } from '@/featureFlags/statsigConstants';
import { getEnvGateOverride } from '@/featureFlags/statsigUser';

const HAS_STATSIG = Boolean(process.env.EXPO_PUBLIC_STATSIG_CLIENT_KEY?.trim());

export function useFeatureGate(gateName: string): boolean {
  if (!HAS_STATSIG) {
    return getEnvGateOverride(gateName);
  }

  return useGateValue(gateName);
}

export function useFlowchartGate(): boolean {

  return true;
}

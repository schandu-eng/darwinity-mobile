import React, { useEffect, useMemo, useRef } from 'react';
import { StatsigProviderExpo, useStatsigUser } from '@statsig/expo-bindings';
import { useAuthStore } from '@/store/memberAuthStore';
import { buildStatsigUser, getStatsigClientKey } from '@/featureFlags/statsigUser';

function StatsigUserSync({
  user,
  children,
}: {
  user: ReturnType<typeof buildStatsigUser>;
  children: React.ReactNode;
}) {
  const { updateUserAsync } = useStatsigUser();
  const lastSyncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const syncKey = JSON.stringify(user);
    if (lastSyncedKeyRef.current === syncKey) return;
    lastSyncedKeyRef.current = syncKey;
    updateUserAsync(user).catch((err) => {
      console.error('Statsig updateUserAsync failed:', err);
    });
  }, [user, updateUserAsync]);

  return <>{children}</>;
}

export default function StatsigAppProvider({ children }: { children: React.ReactNode }) {
  const authUser = useAuthStore((s) => s.user);
  const sdkKey = getStatsigClientKey();

  const user = useMemo(
    () => buildStatsigUser(authUser?.id, authUser?.email),
    [authUser?.id, authUser?.email]
  );

  if (!sdkKey) {
    return <>{children}</>;
  }

  const environment =
    process.env.EXPO_PUBLIC_STATSIG_ENVIRONMENT ||
    (process.env.ENVIRONMENT === 'production' ? 'production' : 'development');

  return (
    <StatsigProviderExpo
      sdkKey={sdkKey}
      user={user}
      options={{
        environment: { tier: environment },
      }}
    >
      <StatsigUserSync user={user}>{children}</StatsigUserSync>
    </StatsigProviderExpo>
  );
}

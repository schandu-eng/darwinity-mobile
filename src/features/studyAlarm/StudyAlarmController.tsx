import { useEffect, useRef } from 'react';
import { consumePendingRing, subscribeStudyAlarmRing } from './native';
import { loadStudyAlarms, saveStudyAlarmCache, subscribeStudyAlarmPrefs } from './storage';
import { prefetchStudyAlarmItems } from './prefetch';
import { syncStudyAlarmSchedule } from './sync';
import { navigationRef } from '@/navigation/navigationRef';
import { useAuthStore } from '@/store';

function openRingScreen(): void {
  if (!navigationRef.isReady()) {
    setTimeout(openRingScreen, 400);
    return;
  }
  navigationRef.navigate('App', { screen: 'StudyAlarmRing' });
}

export function StudyAlarmController() {
  const userId = useAuthStore((s) => s.user?.id);
  const openingRef = useRef(false);

  useEffect(() => {
    const open = () => {
      if (openingRef.current) return;
      openingRef.current = true;
      openRingScreen();
      setTimeout(() => {
        openingRef.current = false;
      }, 2000);
    };

    const unsubNative = subscribeStudyAlarmRing(open);
    void consumePendingRing().then((pending) => {
      if (pending) open();
    });
    const unsubPrefs = subscribeStudyAlarmPrefs(() => {
      void syncStudyAlarmSchedule();
    });
    void syncStudyAlarmSchedule();

    return () => {
      unsubNative();
      unsubPrefs();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const alarms = await loadStudyAlarms();
      const enabled = alarms.filter((alarm) => alarm.enabled && alarm.contentId);
      await Promise.all(
        enabled.map(async (alarm) => {
          if (cancelled || alarm.contentId == null) return;
          try {
            const cache = await prefetchStudyAlarmItems(alarm.mode, alarm.contentId, userId);
            if (cancelled) return;
            await saveStudyAlarmCache(cache);
          } catch {
            /* keep the last good cache */
          }
        })
      );
      if (!cancelled) await syncStudyAlarmSchedule();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}

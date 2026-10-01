import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '@/types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function openAccountModal(): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('App', { screen: 'AccountModal' });
}

export function navigateToUpgradePlans(): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('App', {
    screen: 'AccountModal',
    params: { screen: 'Upgrade' },
  });
}

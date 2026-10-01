import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PhoneTabBar, { type PhoneTabItem } from '@/components/navigation/PhoneTabBar';
import { CreateNoteProvider, type CreateNoteOption } from '@/components/navigation/CreateNoteContext';
import UploadModal from '@/components/upload/UploadModal';
import StudyHubScreen from '@/screens/home/StudyHubScreen';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { Award, GraduationCap, LayoutDashboard, Timer } from '@/icons';
import { useAppTheme } from '@/store/appThemeStore';
import type { HomeTabParamList } from '@/types/navigation';
import {
  OnboardingTourProvider,
  DASHBOARD_TOUR_ID,
  DASHBOARD_TOUR_STEPS,
  adaptDashboardTourSteps,
  type TourStep,
} from '@/components/ui/feature-tour';
import {
  useYoutubePasteAccess,
  YOUTUBE_LIMIT_TYPE,
  YOUTUBE_UPGRADE_MESSAGE,
} from '@/hooks/useProFeatureAccess';
import { showUpgradePaywall } from '@/utils/subscriptionErrorHandler';

const Tab = createBottomTabNavigator<HomeTabParamList>();

const HOME_TAB_META: Record<
  keyof HomeTabParamList,
  { label: string; shortLabel: string; icon: PhoneTabItem['icon'] }
> = {
  HomeFeed: { label: 'Home', shortLabel: 'Home', icon: LayoutDashboard },
  StudyStats: { label: 'Study stats', shortLabel: 'Stats', icon: Award },
  ExamPrep: { label: 'Exam prep', shortLabel: 'Exam', icon: GraduationCap },
  Productivity: { label: 'Productivity', shortLabel: 'Focus', icon: Timer },
};

const loadStudyStatsTabScreen = () => {
  const ConcentrationStatsScreen = require('@/screens/concentration/ConcentrationStatsScreen').default;
  const StudyStatsTabScreen: React.FC = () => {
    const isDark = useAppTheme() === 'dark';
    return (
      <View style={{ flex: 1, backgroundColor: isDark ? '#09090B' : '#F9FAFB' }}>
        <HubHomeHeader />
        <ConcentrationStatsScreen />
      </View>
    );
  };
  return StudyStatsTabScreen;
};

const HomePhoneTabBar: React.FC<BottomTabBarProps & { onCreate: () => void }> = ({
  state,
  navigation,
  onCreate,
}) => {
  const items: PhoneTabItem[] = state.routes.flatMap((route, index) => {
    const meta = HOME_TAB_META[route.name as keyof HomeTabParamList];
    if (!meta) return [];
    const active = state.index === index;
    return [
      {
        id: route.name,
        label: meta.label,
        shortLabel: meta.shortLabel,
        icon: meta.icon,
        active,
        onPress: () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!active && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        },
      },
    ];
  });

  return (
    <PhoneTabBar
      items={items}
      fab={{
        onPress: onCreate,
        accessibilityLabel: 'Create new note',
        tourStepId: 'create',
      }}
    />
  );
};

export const HomeTabNavigator: React.FC = () => {
  const [uploadVisible, setUploadVisible] = useState(false);
  const [initialOption, setInitialOption] = useState<CreateNoteOption | null>(null);
  const { locked: youtubeLocked } = useYoutubePasteAccess();

  const openCreateNote = useCallback(() => {
    setInitialOption(null);
    setUploadVisible(true);
  }, []);

  const openCreateOption = useCallback((option: CreateNoteOption) => {
    if (option === 'paste' && youtubeLocked) {
      showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
      return;
    }
    setInitialOption(option);
    setUploadVisible(true);
  }, [youtubeLocked]);

  const createNoteValue = useMemo(
    () => ({ openCreateNote, openCreateOption }),
    [openCreateNote, openCreateOption]
  );

  const dashboardTourSteps = useMemo(
    () => adaptDashboardTourSteps(DASHBOARD_TOUR_STEPS as TourStep[], { isPhone: true }) as TourStep[],
    [],
  );

  return (
    <CreateNoteProvider value={createNoteValue}>
      <OnboardingTourProvider
        tourId={DASHBOARD_TOUR_ID}
        steps={dashboardTourSteps}
        autoStart
        autoStartDelay={400}
      >
      <Tab.Navigator
        initialRouteName="HomeFeed"
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
        }}
        tabBar={(props) => (
          <HomePhoneTabBar {...props} onCreate={openCreateNote} />
        )}
      >
        <Tab.Screen
          name="HomeFeed"
          component={StudyHubScreen}
          options={{ title: 'Home' }}
        />
        <Tab.Screen
          name="StudyStats"
          getComponent={loadStudyStatsTabScreen}
          options={{ title: 'Study stats' }}
        />
        <Tab.Screen
          name="ExamPrep"
          getComponent={() => require('@/navigation/ExamPrepNavigator').ExamPrepNavigator}
          options={{ title: 'Exam prep' }}
        />
        <Tab.Screen
          name="Productivity"
          getComponent={() => require('@/navigation/ProductivityNavigator').ProductivityNavigator}
          options={{ title: 'Productivity' }}
        />
      </Tab.Navigator>
      </OnboardingTourProvider>
      <UploadModal
        visible={uploadVisible}
        initialOption={initialOption}
        onDismiss={() => {
          setUploadVisible(false);
          setInitialOption(null);
        }}
        sourceScreenForProgress="Home"
      />
    </CreateNoteProvider>
  );
};

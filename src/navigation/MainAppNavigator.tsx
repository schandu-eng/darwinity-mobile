import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeTabNavigator } from './HomeTabNavigator';
import { MaterialNavigator } from './MaterialNavigator';
import { ProfileNavigator } from './ProfileNavigator';
// import ContentFeedbackChecker from '@/components/feedback/ContentFeedbackChecker';
import type { AppStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<AppStackParamList>();

export const MainAppNavigator: React.FC = () => {
  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="Home" component={HomeTabNavigator} />
        <Stack.Screen
          name="CardReel"
          getComponent={() => require('@/screens/card-decks/CardDeckReelScreen').default}
        />
        <Stack.Screen name="Content" component={MaterialNavigator} />
        <Stack.Screen
          name="AccountModal"
          component={ProfileNavigator}
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="StudyAlarmRing"
          getComponent={() => require('@/screens/alarm/StudyAlarmRingScreen').default}
          options={{
            gestureEnabled: false,
            animation: 'fade',
            headerShown: false,
          }}
        />
        <Stack.Group screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="ContentMenuModal"
            getComponent={() => require('@/screens/modals/ContentMenuModalScreen').default}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              ...(Platform.OS === 'ios'
                ? { sheetAllowedDetents: [0.4, 1.0], sheetGrabberVisible: true }
                : {}),
            }}
          />
          <Stack.Screen
            name="RenameNoteModal"
            getComponent={() => require('@/screens/modals/RenameNoteModalScreen').default}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="ExportModal"
            getComponent={() => require('@/screens/modals/ExportModalScreen').default}
            options={{
              presentation: 'transparentModal',
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="AddToFolderModal"
            getComponent={() => require('@/screens/modals/AddToFolderModalScreen').default}
            options={{
              presentation: 'modal',
              animation: 'slide_from_bottom',
              ...(Platform.OS === 'ios'
                ? { sheetAllowedDetents: [0.5, 1.0], sheetGrabberVisible: true }
                : {}),
            }}
          />
        </Stack.Group>
      </Stack.Navigator>
      {/* Auto star-rating prompt paused — see DO_IT_LATER.md
      <ContentFeedbackChecker />
      */}
    </>
  );
};

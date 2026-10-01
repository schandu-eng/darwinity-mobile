import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ContentStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

const Stack = createNativeStackNavigator<ContentStackParamList>();

const HeaderBack: React.FC<{ onPress: () => void; color: string }> = ({ onPress, color }) => (
  <TouchableOpacity
    onPress={onPress}
    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
    activeOpacity={0.6}
  >
    <MaterialCommunityIcons name="arrow-left" size={24} color={color} />
  </TouchableOpacity>
);

export const MaterialNavigator: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontFamily: Fonts.ui.semiBold,
        },
      }}
    >
      <Stack.Screen
        name="ContentList"
        getComponent={() => require('@/screens/content/ContentScreen').default}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ContentDetail"
        getComponent={() => require('@/screens/content/MaterialDetailScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="NotesEditor"
        getComponent={() => require('@/screens/content/NotesEditorScreen').default}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          gestureEnabled: true,
        }}
      />
      <Stack.Screen
        name="Folders"
        getComponent={() => require('@/screens/folders/FoldersScreen').default}
        options={({ navigation }) => ({
          title: 'Folders',
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderBack onPress={() => navigation.goBack()} color={theme.colors.primary} />,
        })}
      />
      <Stack.Screen
        name="FolderDetail"
        getComponent={() => require('@/screens/folders/FolderDetailScreen').default}
        options={({ navigation }) => ({
          title: 'Folder',
          headerTitleAlign: 'center',
          headerLeft: () => <HeaderBack onPress={() => navigation.goBack()} color={theme.colors.primary} />,
        })}
      />
      <Stack.Screen
        name="Upload"
        getComponent={() => require('@/screens/upload/UploadScreen').default}
        options={{
          title: 'Upload Content',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="UploadProgress"
        getComponent={() => require('@/screens/upload/UploadProgressScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="YouTubeLink"
        getComponent={() => require('@/screens/upload/YouTubeLinkScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AudioRecording"
        getComponent={() => require('@/screens/upload/AudioRecordingScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Chat"
        getComponent={() => require('@/screens/chat/ChatScreen').default}
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="Quiz"
        getComponent={() => require('@/screens/quiz/QuizScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Flashcards"
        getComponent={() => require('@/screens/card-decks/CardDeckScreen').default}
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="Podcast"
        getComponent={() => require('@/screens/podcast/PodcastScreen').default}
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="Flowchart"
        getComponent={() => require('@/screens/flowchart/FlowchartScreen').default}
        options={{
          headerShown: true,
          title: 'Mind map',
        }}
      />
      <Stack.Screen
        name="Games"
        getComponent={() => require('@/screens/games/StudyGamesScreen').default}
        options={{
          headerShown: true,
          title: 'Games',
        }}
      />
    </Stack.Navigator>
  );
};

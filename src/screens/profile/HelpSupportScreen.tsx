import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import SettingsListRow from '@/components/profile/SettingsListRow';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { ACCOUNT_LINKS } from '@/config/accountLinks';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { openExternalUrl } from '@/utils/openUrl';

type HelpNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'HelpSupport'>;

const FEATURED_FAQS = [
  'What is Darwinity?',
  'What can I upload?',
  'Is Darwinity free to use?',
];

const HelpSupportScreen: React.FC = () => {
  const navigation = useNavigation<HelpNavigationProp>();
  const insets = useSafeAreaInsets();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);

  const firstName = useMemo(() => {
    const part = user?.name?.trim().split(/\s+/)[0];
    return part || 'there';
  }, [user?.name]);

  const handleChat = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.support, 'Unable to open support page');
  }, []);

  const handleFaq = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.faq, 'Unable to open FAQ');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: BRAND_COLORS.white }]}>
      <InkPanelGradient
        style={styles.hero}
        contentStyle={[styles.heroContent, { paddingTop: insets.top + 8 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#FAF9F6" />
        </TouchableOpacity>

        <Text style={styles.greeting}>Hi {firstName},</Text>
        <Text style={styles.greeting}>how can I help you?</Text>

        <TouchableOpacity onPress={handleChat} style={styles.chatButton} activeOpacity={0.85}>
          <MaterialCommunityIcons name="message-outline" size={18} color={BRAND_COLORS.ink} />
          <Text style={styles.chatButtonText}>Chat with us</Text>
        </TouchableOpacity>
      </InkPanelGradient>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsListRow
          icon="information-outline"
          label="FAQs"
          onPress={handleFaq}
          showChevron
          showDivider={false}
          theme={theme}
        />
        {FEATURED_FAQS.map((question) => (
          <SettingsListRow
            key={question}
            label={question}
            onPress={handleFaq}
            showChevron={false}
            showDivider={false}
            indented
            theme={theme}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    overflow: 'hidden',
  },
  heroContent: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: -8,
    padding: 8,
    marginBottom: 16,
  },
  greeting: {
    color: '#FAF9F6',
    fontSize: 28,
    fontFamily: Fonts.display.bold,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  chatButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF9F6',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginTop: 20,
  },
  chatButtonText: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    color: BRAND_COLORS.ink,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
});

export default HelpSupportScreen;

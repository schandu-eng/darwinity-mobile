import React, { useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import SettingsListRow from '@/components/profile/SettingsListRow';
import { ACCOUNT_LINKS } from '@/config/accountLinks';
import { BRAND_COLORS } from '@/config/brand';
import { openExternalUrl } from '@/utils/openUrl';

const AboutScreen: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const openTerms = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.terms, 'Unable to open Terms of Service');
  }, []);

  const openPrivacy = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.privacy, 'Unable to open Privacy Policy');
  }, []);

  const openEula = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.eula, 'Unable to open Terms of Use (EULA)');
  }, []);

  const openWebsite = useCallback(() => {
    void openExternalUrl(ACCOUNT_LINKS.website, 'Unable to open website');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: BRAND_COLORS.white }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SettingsListRow
          icon="file-document-outline"
          label="Terms and conditions"
          onPress={openTerms}
          showChevron={false}
          theme={theme}
        />
        <SettingsListRow
          icon="lock-outline"
          label="Privacy policy"
          onPress={openPrivacy}
          showChevron={false}
          theme={theme}
        />
        <SettingsListRow
          icon="shield-outline"
          label="Terms of use (EULA)"
          onPress={openEula}
          showChevron={false}
          theme={theme}
        />
        <SettingsListRow
          icon="web"
          label="Website"
          onPress={openWebsite}
          showChevron={false}
          theme={theme}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
});

export default AboutScreen;

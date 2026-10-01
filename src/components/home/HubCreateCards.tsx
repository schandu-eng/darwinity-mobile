import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { Link2, Mic, Upload, type LucideIcon } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import FeatureProTag from '@/components/ui/pro/FeatureProTag';
import { useYoutubePasteAccess } from '@/hooks/useProFeatureAccess';

export type CreateCardId = 'upload' | 'paste' | 'record';

const CARDS: {
  id: CreateCardId;
  label: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}[] = [
  { id: 'upload', label: 'Upload', icon: Upload, iconBg: 'rgba(63,107,79,0.14)', iconColor: BRAND_COLORS.ink },
  { id: 'paste', label: 'Paste', icon: Link2, iconBg: '#E8EDE9', iconColor: BRAND_COLORS.growth },
  { id: 'record', label: 'Record', icon: Mic, iconBg: '#DDE6E0', iconColor: '#2F4F3E' },
];

type HubCreateCardsProps = {
  userName?: string | null;
  onSelect: (id: CreateCardId) => void;
};

export const HubCreateCards: React.FC<HubCreateCardsProps> = ({ userName, onSelect }) => {
  const isDark = useAppTheme() === 'dark';
  const { locked: youtubeLocked } = useYoutubePasteAccess();
  const firstName = (userName || 'there').trim().split(/\s+/)[0] || 'there';

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: isDark ? '#FAFAFA' : '#18181B' }]}>
        Hey {firstName}, what do you wanna master?
      </Text>
      <Text style={[styles.sub, { color: isDark ? '#A1A1AA' : '#52525B' }]}>
        Feed it once. Unlock the whole toolkit.
      </Text>
      <View style={styles.grid}>
        {CARDS.map((card) => {
          const Icon = card.icon;
          const proLocked = card.id === 'paste' && youtubeLocked;
          return (
            <Pressable
              key={card.id}
              onPress={() => onSelect(card.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isDark ? '#111113' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={proLocked ? `${card.label}, Pro feature, locked` : card.label}
            >
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: isDark ? 'rgba(63,107,79,0.2)' : card.iconBg,
                    borderColor: isDark ? 'rgba(122,158,134,0.25)' : 'rgba(26,47,35,0.15)',
                  },
                ]}
              >
                <Icon
                  size={16}
                  strokeWidth={ICON_STROKE}
                  color={isDark ? '#7A9E86' : card.iconColor}
                  opacity={proLocked ? 0.5 : 1}
                />
                {proLocked ? <FeatureProTag variant="icon" /> : null}
              </View>
              <Text style={[styles.cardLabel, { color: isDark ? '#F4F4F5' : '#18181B' }]}>
                {card.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    position: 'relative',
    marginBottom: 16,
  },
  heading: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  sub: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(26,47,35,0.04)' },
      default: {
        shadowColor: BRAND_COLORS.ink,
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
  },
});

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBase } from '@/components/ui/skeleton/SkeletonBase';
import { useAppTheme } from '@/store/appThemeStore';

const LIST_ROWS = [52, 38, 64, 44, 56, 34];
const GRID_WIDTHS = [42, 58, 36, 64, 48, 52];

type PanelSkeletonProps = {
  variant?: 'list' | 'grid';
  /** How many rows/cards (default 6). */
  rows?: number;
  label?: string;
  /** Skip the top header chrome (icon + title lines). */
  hideHeader?: boolean;
  style?: object;
};

/**
 * Phone-web `PanelSkeleton` (`ui/panel-skeleton.jsx`) — home/study loading chrome.
 */
export const PanelSkeleton: React.FC<PanelSkeletonProps> = ({
  variant = 'list',
  rows,
  label = 'Loading',
  hideHeader = false,
  style,
}) => {
  const isDark = useAppTheme() === 'dark';
  const count = rows ?? (variant === 'grid' ? GRID_WIDTHS.length : LIST_ROWS.length);
  const widths = variant === 'grid' ? GRID_WIDTHS : LIST_ROWS;
  const cardBg = isDark ? '#111113' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';

  if (variant === 'grid') {
    return (
      <View style={[styles.pad, style]} accessibilityLabel={label} accessibilityRole="progressbar">
        {!hideHeader ? (
          <View style={styles.header}>
            <SkeletonBase style={styles.headerIcon} borderRadius={16} />
            <View style={styles.headerCopy}>
              <SkeletonBase style={styles.headerTitle} borderRadius={6} />
              <SkeletonBase style={styles.headerSub} borderRadius={6} />
            </View>
          </View>
        ) : null}
        <View style={styles.grid}>
          {widths.slice(0, count).map((titleWidth, i) => (
            <View key={i} style={[styles.gridCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.gridTop}>
                <SkeletonBase style={styles.gridIcon} borderRadius={8} delayMs={i * 80} />
                <SkeletonBase style={styles.gridMenu} borderRadius={14} delayMs={i * 80 + 40} />
              </View>
              <SkeletonBase
                style={[styles.gridTitle, { width: `${titleWidth}%` }]}
                borderRadius={6}
                delayMs={i * 80 + 60}
              />
              <SkeletonBase style={styles.gridSub} borderRadius={6} delayMs={i * 80 + 100} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.pad, style]} accessibilityLabel={label} accessibilityRole="progressbar">
      {!hideHeader ? (
        <View style={styles.header}>
          <SkeletonBase style={styles.headerIcon} borderRadius={16} />
          <View style={styles.headerCopy}>
            <SkeletonBase style={styles.headerTitleWide} borderRadius={6} />
            <SkeletonBase style={styles.headerSubWide} borderRadius={6} />
          </View>
        </View>
      ) : null}
      <View style={[styles.listStack, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {LIST_ROWS.slice(0, count).map((titleWidth, i) => (
          <View
            key={i}
            style={[
              styles.listCard,
              i < count - 1 && { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5' },
              i === count - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <SkeletonBase style={styles.listIcon} borderRadius={8} delayMs={i * 90} />
            <View style={styles.listCopy}>
              <SkeletonBase
                style={[styles.listTitle, { width: `${titleWidth}%` }]}
                borderRadius={6}
                delayMs={i * 90 + 40}
              />
              <SkeletonBase style={styles.listSub} borderRadius={6} delayMs={i * 90 + 80} />
            </View>
            <SkeletonBase style={styles.listMenu} borderRadius={14} delayMs={i * 90 + 110} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  pad: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  headerIcon: { width: 44, height: 44 },
  headerCopy: { flex: 1, minWidth: 0, gap: 8 },
  headerTitle: { height: 16, width: 144 },
  headerSub: { height: 12, width: 200, maxWidth: '100%' },
  headerTitleWide: { height: 16, width: 160 },
  headerSubWide: { height: 12, width: 220, maxWidth: '100%' },
  listStack: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  listIcon: { width: 32, height: 32 },
  listCopy: { flex: 1, minWidth: 0, gap: 8 },
  listTitle: { height: 14, maxWidth: '100%' },
  listSub: { height: 10, width: '28%' },
  listMenu: { width: 28, height: 28, opacity: 0.7 },
  grid: { gap: 12 },
  gridCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  gridTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridIcon: { width: 40, height: 40 },
  gridMenu: { width: 32, height: 32 },
  gridTitle: { height: 14, marginBottom: 8 },
  gridSub: { height: 12, width: '38%' },
});

export default PanelSkeleton;

import React, { memo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Fonts } from '@/config/fonts';

export type ProgressStage = 1 | 2 | 3;

interface Stage {
  id: ProgressStage;
  label: string;
  icon: string;
}

const stages: Stage[] = [
  { id: 1, label: 'Upload', icon: 'upload' },
  { id: 2, label: 'Processing', icon: 'cog' },
  { id: 3, label: 'Finding topics', icon: 'file-search-outline' },
];

interface StageProgressBarProps {
  currentStage: ProgressStage;
  theme: any;
}

const StageProgressBarComponent: React.FC<StageProgressBarProps> = ({ currentStage, theme }) => {
  return (
    <View style={styles.container}>
      {stages.map((stage, index) => {
        const isActive = stage.id <= currentStage;
        const isCurrent = stage.id === currentStage;
        const showConnector = index < stages.length - 1;

        return (
          <React.Fragment key={stage.id}>
            <View style={styles.stageContainer}>
              <View
                style={[
                  styles.stageCircle,
                  {
                    backgroundColor: isActive ? theme.colors.primary : theme.colors.surfaceVariant,
                    borderColor: isActive ? theme.colors.primary : theme.colors.outlineVariant,
                    borderWidth: isActive ? 0 : 1.5,
                  },
                  undefined,
                ]}
              >
                <MaterialCommunityIcons
                  name={stage.icon as any}
                  size={22}
                  color={isActive ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                />
              </View>
              <Text
                style={[
                  styles.stageLabel,
                  {
                    color: isActive ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    fontFamily: isCurrent ? Fonts.ui.semiBold : Fonts.ui.medium,
                    opacity: isActive ? 1 : 0.6,
                  },
                ]}
                numberOfLines={2}
              >
                {stage.label}
              </Text>
            </View>
            {showConnector && (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: stage.id < currentStage ? theme.colors.primary : theme.colors.outlineVariant,
                    opacity: stage.id < currentStage ? 1 : 0.3,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  stageContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    minWidth: 70,
    paddingHorizontal: 2,
  },
  stageCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 13,
    paddingHorizontal: 2,
    width: '100%',
    minHeight: 26,
  },
  connector: {
    flex: 1,
    height: 3,
    marginHorizontal: 4,
    marginTop: -38,
    borderRadius: 1.5,
  },
});

const StageProgressBar = memo(StageProgressBarComponent);

export default StageProgressBar;


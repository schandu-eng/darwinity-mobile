import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import type { OcclusionRegion } from './cardDeckContentUtils';
import CardDeckAutoImage from './CardDeckAutoImage';

import { Fonts } from '@/config/fonts';

type Props = {
  src: string;
  regions?: OcclusionRegion[];
  reveal?: boolean;
};

const CardDeckImageOcclusion: React.FC<Props> = ({ src, regions = [], reveal = false }) => {
  const safeRegions = useMemo(
    () =>
      (regions || []).filter(
        (r) =>
          typeof r.x === 'number' &&
          typeof r.y === 'number' &&
          typeof r.w === 'number' &&
          typeof r.h === 'number' &&
          r.w > 0 &&
          r.h > 0
      ),
    [regions]
  );

  if (!src) return null;

  return (
    <View style={styles.container}>
      <CardDeckAutoImage uri={src} maxWidth={320} />
      {!reveal &&
        safeRegions.map((region, index) => (
          <View
            key={index}
            style={[
              styles.region,
              {
                left: `${region.x * 100}%`,
                top: `${region.y * 100}%`,
                width: `${region.w * 100}%`,
                height: `${region.h * 100}%`,
              },
            ]}
            pointerEvents="none"
          >
            <View style={styles.mask} />
            {region.label ? (
              <Text style={styles.label} numberOfLines={2}>
                {region.label}
              </Text>
            ) : null}
          </View>
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    position: 'relative',
  },
  region: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  mask: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 24, 27, 0.92)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(63, 63, 70, 0.9)',
  },
  label: {
    position: 'relative',
    zIndex: 1,
    fontSize: 10,
    fontFamily: Fonts.ui.semiBold,
    color: '#1E3A8A',
    textAlign: 'center',
    backgroundColor: 'rgba(219, 234, 254, 0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default CardDeckImageOcclusion;

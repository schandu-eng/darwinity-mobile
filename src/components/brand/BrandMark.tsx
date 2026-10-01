import React from 'react';
import Svg, { Circle, Rect } from 'react-native-svg';
import { BRAND_COLORS } from '@/config/brand';

type BrandMarkProps = {
  size?: number;
  color?: string;
};

export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 40,
  color = BRAND_COLORS.ink,
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityRole="image">
    <Circle cx="26" cy="36" r="20" fill={color} />
    <Rect x="38" y="8" width="14" height="48" rx="3" fill={color} />
  </Svg>
);

export default BrandMark;

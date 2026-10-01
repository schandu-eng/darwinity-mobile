import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';
import { resolveMarkdownImageUri, syncDisplayNoteImageUrl } from '@/utils/noteImageUrl';

const DEFAULT_MAX_WIDTH = 320;

type Props = {
  uri: string;
  style?: StyleProp<ImageStyle>;
  maxWidth?: number;
};

const CardDeckAutoImage: React.FC<Props> = ({
  uri,
  style,
  maxWidth = DEFAULT_MAX_WIDTH,
}) => {
  const [resolvedUri, setResolvedUri] = useState(() => syncDisplayNoteImageUrl(uri) || '');
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResolvedUri(syncDisplayNoteImageUrl(uri) || '');
    resolveMarkdownImageUri(uri).then((next) => {
      if (!cancelled && next) setResolvedUri(next);
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const onLoad = useCallback(
    (e: { nativeEvent: { source: { width: number; height: number } } }) => {
      const { width: iw, height: ih } = e.nativeEvent.source;
      if (!iw || !ih) return;

      const width = maxWidth;
      const height = (ih / iw) * width;
      setSize({ width, height });
    },
    [maxWidth]
  );

  if (!resolvedUri) return null;

  return (
    <Image
      source={{ uri: resolvedUri }}
      onLoad={onLoad}
      resizeMode="contain"
      style={[
        styles.image,
        size ?? styles.placeholder,
        size ? { width: size.width, height: size.height } : { maxWidth },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  image: {
    borderRadius: 12,
    alignSelf: 'center',
  },
  placeholder: {
    width: '100%',
    maxWidth: DEFAULT_MAX_WIDTH,
    height: 160,
  },
});

export default CardDeckAutoImage;

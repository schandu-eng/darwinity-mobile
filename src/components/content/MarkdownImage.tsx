import React, { useEffect, useState } from 'react';
import { type StyleProp, type ImageStyle } from 'react-native';
import FitImage from 'react-native-fit-image';
import { resolveMarkdownImageUri, syncDisplayNoteImageUrl } from '@/utils/noteImageUrl';

type MarkdownImageProps = {
  src: string;
  alt?: string;
  style?: StyleProp<ImageStyle>;
};

/** Markdown image: absolute API URL + note-image presign. Key must be passed by the parent, not spread. */
export const MarkdownImage: React.FC<MarkdownImageProps> = ({ src, alt, style }) => {
  const [uri, setUri] = useState(() => syncDisplayNoteImageUrl(src));

  useEffect(() => {
    let cancelled = false;
    resolveMarkdownImageUri(src).then((next) => {
      if (!cancelled && next) setUri(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!uri) return null;

  return (
    <FitImage
      indicator
      source={{ uri }}
      style={style}
      accessible={Boolean(alt)}
      accessibilityLabel={alt || undefined}
    />
  );
};

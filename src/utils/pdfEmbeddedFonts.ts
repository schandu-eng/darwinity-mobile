import { Asset } from 'expo-asset';
import {
  buildEmbeddedFontCss,
  PDF_FONT_DESCRIPTORS,
} from '@shared/notesPdfFonts.js';

const fontModuleMap: Record<string, number> = {
  'Outfit-Regular.ttf': require('@shared/pdf-fonts/Outfit-Regular.ttf'),
  'Outfit-SemiBold.ttf': require('@shared/pdf-fonts/Outfit-SemiBold.ttf'),
  'Outfit-Bold.ttf': require('@shared/pdf-fonts/Outfit-Bold.ttf'),
  'Outfit-ExtraBold.ttf': require('@shared/pdf-fonts/Outfit-ExtraBold.ttf'),
  'NotoSans-Regular.ttf': require('@shared/pdf-fonts/NotoSans-Regular.ttf'),
  'NotoSans-Bold.ttf': require('@shared/pdf-fonts/NotoSans-Bold.ttf'),
  'NotoSansMono-Regular.ttf': require('@shared/pdf-fonts/NotoSansMono-Regular.ttf'),
  'NotoSansMono-Bold.ttf': require('@shared/pdf-fonts/NotoSansMono-Bold.ttf'),
  'NotoSansSymbols-Regular.ttf': require('@shared/pdf-fonts/NotoSansSymbols-Regular.ttf'),
  'NotoSansDevanagari-Regular.ttf': require('@shared/pdf-fonts/NotoSansDevanagari-Regular.ttf'),
  'NotoSansArabic-Regular.ttf': require('@shared/pdf-fonts/NotoSansArabic-Regular.ttf'),
  'NotoSansHebrew-Regular.ttf': require('@shared/pdf-fonts/NotoSansHebrew-Regular.ttf'),
  'NotoSansThai-Regular.ttf': require('@shared/pdf-fonts/NotoSansThai-Regular.ttf'),
  'NotoSansTamil-Regular.ttf': require('@shared/pdf-fonts/NotoSansTamil-Regular.ttf'),
  'NotoSansTelugu-Regular.ttf': require('@shared/pdf-fonts/NotoSansTelugu-Regular.ttf'),
  'NotoSansBengali-Regular.ttf': require('@shared/pdf-fonts/NotoSansBengali-Regular.ttf'),
  'NotoSansGurmukhi-Regular.ttf': require('@shared/pdf-fonts/NotoSansGurmukhi-Regular.ttf'),
  'NotoSansGujarati-Regular.ttf': require('@shared/pdf-fonts/NotoSansGujarati-Regular.ttf'),
  'NotoSansKannada-Regular.ttf': require('@shared/pdf-fonts/NotoSansKannada-Regular.ttf'),
  'NotoSansMalayalam-Regular.ttf': require('@shared/pdf-fonts/NotoSansMalayalam-Regular.ttf'),
  'NotoSansOriya-Regular.ttf': require('@shared/pdf-fonts/NotoSansOriya-Regular.ttf'),
  'NotoSansSinhala-Regular.ttf': require('@shared/pdf-fonts/NotoSansSinhala-Regular.ttf'),
  'NotoSansMyanmar-Regular.ttf': require('@shared/pdf-fonts/NotoSansMyanmar-Regular.ttf'),
  'DroidSansFallbackFull.ttf': require('@shared/pdf-fonts/DroidSansFallbackFull.ttf'),
};

let cachedEmbeddedFontCssPromise: Promise<string> | null = null;

export const getEmbeddedPdfFontCss = (): Promise<string> => {
  if (!cachedEmbeddedFontCssPromise) {
    cachedEmbeddedFontCssPromise = (async () => {
      const descriptorsWithModules = PDF_FONT_DESCRIPTORS
        .map((descriptor) => ({
          descriptor,
          moduleId: fontModuleMap[descriptor.fileName],
        }))
        .filter((entry) => typeof entry.moduleId === 'number');

      const assets = await Promise.all(
        descriptorsWithModules.map(async ({ moduleId }) => {
          const asset = Asset.fromModule(moduleId);
          if (!asset.downloaded) {
            await asset.downloadAsync();
          }
          return asset;
        }),
      );

      const assetUrlMap = new Map<string, string>();
      descriptorsWithModules.forEach(({ descriptor }, index) => {
        const asset = assets[index];
        const assetUrl = asset.localUri || asset.uri || '';
        if (assetUrl) {
          assetUrlMap.set(descriptor.fileName, assetUrl);
        }
      });

      return buildEmbeddedFontCss((descriptor) => assetUrlMap.get(descriptor.fileName) || '');
    })();
  }

  return cachedEmbeddedFontCssPromise;
};

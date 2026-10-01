module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@/api': './src/api',
            '@/components': './src/components',
            '@/screens': './src/screens',
            '@/navigation': './src/navigation',
            '@/store': './src/store',
            '@/services': './src/services',
            '@/hooks': './src/hooks',
            '@/utils': './src/utils',
            '@/types': './src/types',
            '@/theme': './src/theme',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};

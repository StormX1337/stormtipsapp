/** Expo's Babel preset already covers expo-router and Reanimated in SDK 54. */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'react' }]],
  };
};

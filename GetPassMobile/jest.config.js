module.exports = {
  preset: '@react-native/jest-preset',
  // These ship untranspiled ESM, so Jest's default node_modules ignore has to be
  // narrowed to let Babel process them too.
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|@react-native-async-storage)/)',
  ],
};

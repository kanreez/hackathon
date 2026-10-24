// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // The Express backend runs in Node, not React Native
    files: ['server/**/*.js'],
    languageOptions: { globals: { require: 'readonly', module: 'writable', process: 'readonly', __dirname: 'readonly', Buffer: 'readonly', console: 'readonly' } },
  },
]);

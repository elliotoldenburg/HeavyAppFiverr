// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  // [Web-only]: Enables CSS support in Metro.
  isCSSEnabled: true,
});

// Add support for webp files
config.resolver.assetExts.push('webp');
config.resolver.unstable_enablePackageExports = false;
// Increase memory limit
config.maxWorkers = 2; // Reduce number of workers
config.transformer.minifierConfig = {
  compress: false, // Disable compression during development
  mangle: false // Disable name mangling
};

module.exports = config;
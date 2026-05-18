const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add polyfills for Node.js core modules used by libraries like xlsx
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  util: require.resolve("util/"),
  assert: require.resolve("assert/"),
};

module.exports = withNativeWind(config, { input: "./global.css" });

const appJson = require("./app.json");

const baseConfig = appJson.expo ?? appJson;

module.exports = () => {
  const isDevelopment = process.env.APP_VARIANT === "development";

  return {
    ...baseConfig,

    name: isDevelopment ? "BreedSmart Dev" : baseConfig.name,

    scheme: isDevelopment
      ? "ilo-agriculture-dev"
      : baseConfig.scheme,

    ios: {
      ...baseConfig.ios,
      bundleIdentifier: isDevelopment
        ? "com.breedsmart.mobile.dev"
        : baseConfig.ios.bundleIdentifier,
    },

    android: {
      ...baseConfig.android,
      package: isDevelopment
        ? "com.breedsmart.mobile.dev"
        : baseConfig.android.package,
    },
  };
};
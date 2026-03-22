module.exports = ({ config }) => {
  const expoDevDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;
  const proxyUrl =
    process.env.EXPO_PACKAGER_PROXY_URL ||
    (expoDevDomain ? `https://${expoDevDomain}` : "https://replit.com/");

  // API URL: use the Expo domain (Metro will proxy /api → localhost:8080)
  // For native/physical device: falls back to the main Replit dev domain
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const apiUrl = expoDevDomain
    ? `https://${expoDevDomain}/api`
    : devDomain
    ? `https://${devDomain}/api`
    : process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api";

  return {
    ...config,
    plugins: (config.plugins || []).map((plugin) => {
      if (Array.isArray(plugin) && plugin[0] === "expo-router") {
        return [plugin[0], { ...plugin[1], origin: proxyUrl }];
      }
      return plugin;
    }),
    extra: {
      ...(config.extra || {}),
      apiUrl,
      router: {
        ...((config.extra || {}).router || {}),
        origin: proxyUrl,
        headOrigin: proxyUrl,
      },
    },
  };
};

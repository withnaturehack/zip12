module.exports = ({ config }) => {
  const proxyUrl =
    process.env.EXPO_PACKAGER_PROXY_URL ||
    (process.env.REPLIT_EXPO_DEV_DOMAIN
      ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
      : "https://replit.com/");

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
      router: {
        ...((config.extra || {}).router || {}),
        origin: proxyUrl,
        headOrigin: proxyUrl,
      },
    },
  };
};

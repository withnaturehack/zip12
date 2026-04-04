module.exports = function applyAppConfig({ config }) {
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;

  const proxyUrl = process.env.EXPO_PUBLIC_WEB_ORIGIN || "https://localhost";
  const apiUrl = explicitApiUrl || "http://localhost:8080/api";

  return {
    ...config,
    plugins: (config.plugins || []).map((plugin) => {
      if (Array.isArray(plugin) && plugin[0] === "expo-router") {
        return [plugin[0], { ...plugin[1], origin: proxyUrl }];
      }
      return plugin;
    }),
    extra: {
      ...config.extra,
      apiUrl,
      router: {
        ...config.extra?.router,
        origin: proxyUrl,
        headOrigin: proxyUrl,
      },
    },
  };
};

module.exports = ({ config }) => {
  const expoDevDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;
  const prodDomain = process.env.REPLIT_INTERNAL_APP_DOMAIN;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;

  const proxyUrl =
    process.env.EXPO_PACKAGER_PROXY_URL ||
    (prodDomain ? `https://${prodDomain}` : null) ||
    (expoDevDomain ? `https://${expoDevDomain}` : "https://replit.com/");

  // API URL priority: production domain > dev expo domain > dev domain > env var > localhost
  // Metro always proxies /api/* to the Express server on port 8080
  const apiUrl = prodDomain
    ? `https://${prodDomain}/api`
    : expoDevDomain
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

module.exports = ({ config }) => {
  const expoDevDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;
  // REPLIT_INTERNAL_APP_DOMAIN is not available in Cloud Run — use REPLIT_DOMAINS instead.
  // REPLIT_DOMAINS is a comma-separated list set by Replit in both dev and deployed environments.
  const replitDomains = process.env.REPLIT_DOMAINS;
  const prodDomain =
    (replitDomains ? replitDomains.split(",")[0].trim() : null) ||
    process.env.REPLIT_INTERNAL_APP_DOMAIN ||
    null;
  const devDomain = process.env.REPLIT_DEV_DOMAIN;

  // Build a safe proxy URL — never produce "https://" with an empty host.
  function safeUrl(domain) {
    if (!domain || !domain.trim()) return null;
    return `https://${domain.trim()}`;
  }

  const proxyUrl =
    safeUrl(expoDevDomain) ||
    safeUrl(prodDomain) ||
    safeUrl(devDomain) ||
    "https://localhost";

  // API URL priority: prod domain > expo dev domain > dev domain > env var > localhost
  // Web (browser) builds always use /api (relative) via the Metro proxy — see AuthContext.tsx.
  // This absolute URL is only used by native (Expo Go / EAS APK).
  const apiUrl =
    (prodDomain ? `https://${prodDomain}/api` : null) ||
    (expoDevDomain ? `https://${expoDevDomain}/api` : null) ||
    (devDomain ? `https://${devDomain}/api` : null) ||
    process.env.EXPO_PUBLIC_API_URL ||
    "http://localhost:8080/api";

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

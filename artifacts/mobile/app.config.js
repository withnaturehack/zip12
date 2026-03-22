module.exports = ({ config }) => {
  // EXPO_PUBLIC_API_URL is explicitly set in eas.json for all EAS builds.
  // It is also set in .env for local dev. This is the primary source for native API URL.
  const explicitApiUrl = process.env.EXPO_PUBLIC_API_URL;

  // Replit-specific domains (only available in Replit dev environment, not in EAS builds)
  const expoDevDomain = process.env.REPLIT_EXPO_DEV_DOMAIN;
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

  // proxyUrl is used by expo-router for deep linking origin.
  const proxyUrl =
    safeUrl(expoDevDomain) ||
    safeUrl(prodDomain) ||
    safeUrl(devDomain) ||
    (explicitApiUrl ? explicitApiUrl.replace(/\/api$/, "") : null) ||
    "https://localhost";

  // apiUrl for native (web always uses relative /api via Metro proxy — see AuthContext.tsx).
  // Priority: explicit env var (EAS build) > Replit dev expo domain > Replit dev domain > localhost
  const apiUrl =
    explicitApiUrl ||
    (expoDevDomain ? `https://${expoDevDomain}/api` : null) ||
    (prodDomain ? `https://${prodDomain}/api` : null) ||
    (devDomain ? `https://${devDomain}/api` : null) ||
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

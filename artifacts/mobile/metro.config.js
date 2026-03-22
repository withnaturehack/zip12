const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");

const API_PORT = 8080;

function proxyToApi(req, res) {
  const options = {
    hostname: "127.0.0.1",
    port: API_PORT,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `localhost:${API_PORT}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502);
    res.end(JSON.stringify({ error: "Proxy error", message: err.message }));
  });

  req.pipe(proxyReq, { end: true });
}

const config = getDefaultConfig(__dirname);
config.server = config.server || {};
const originalEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const base = originalEnhance ? originalEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    if (req.url && req.url.startsWith("/api")) {
      proxyToApi(req, res);
    } else {
      base(req, res, next);
    }
  };
};

module.exports = config;

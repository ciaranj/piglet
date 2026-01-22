module.exports = {
  "/_pigsty/api": {
    target: "http://localhost:3000",
    secure: false,
    logLevel: "debug"
  },
  "/_auth": {
    target: "http://localhost:3000",
    secure: false,
    logLevel: "debug"
  },
  "/health": {
    target: "http://localhost:3000",
    secure: false
  },
  "/api/status": {
    target: "http://localhost:3000",
    secure: false
  },
  "/**": {
    target: "http://localhost:3000",
    secure: false,
    bypass: function(req) {
      // Let Angular handle /_pigsty routes (except API)
      if (req.url.startsWith('/_pigsty') && !req.url.startsWith('/_pigsty/api')) {
        return req.url;
      }
      // Proxy everything else to backend
      return null;
    }
  }
};

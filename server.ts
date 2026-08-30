import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security: Payload size limits & json parser security
  app.use(express.json({ limit: "16kb" }));

  // In-memory visitor session tracker with real-time heartbeat & rate protection
  let totalVisitorsCount = 142; // Seeded initial frontier visitors count
  const activeSessions = new Map<string, number>();
  const requestThrottle = new Map<string, number>();

  // API endpoints
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.post("/api/visitors/ping", (req, res) => {
    try {
      // Sanitize & validate session ID
      let rawId = "";
      if (req.body && typeof req.body.sessionId === "string") {
        rawId = req.body.sessionId.trim();
      }
      if (!rawId) {
        rawId = (req.headers["x-forwarded-for"] as string) || "guest";
      }

      // Security: Clean and limit identifier length to prevent memory exhaustion / injection
      const sanitizedSessionId = rawId.replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 64) || `sess_${Date.now()}`;

      // Rate limit check: max 1 ping per 1.5s per session
      const now = Date.now();
      const lastReq = requestThrottle.get(sanitizedSessionId) || 0;
      if (now - lastReq < 1500) {
        return res.json({
          onlineCount: Math.max(1, activeSessions.size),
          totalVisitors: totalVisitorsCount,
          serverTime: now
        });
      }
      requestThrottle.set(sanitizedSessionId, now);

      const isNew = !activeSessions.has(sanitizedSessionId);
      if (isNew) {
        totalVisitorsCount += 1;
      }
      activeSessions.set(sanitizedSessionId, now);

      // Clean inactive sessions (> 45s) and stale throttle entries
      const cutoff = now - 45000;
      for (const [id, lastSeen] of activeSessions.entries()) {
        if (lastSeen < cutoff) {
          activeSessions.delete(id);
          requestThrottle.delete(id);
        }
      }

      res.json({
        onlineCount: Math.max(1, activeSessions.size),
        totalVisitors: totalVisitorsCount,
        serverTime: now
      });
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/visitors/stats", (_req, res) => {
    const cutoff = Date.now() - 45000;
    for (const [id, lastSeen] of activeSessions.entries()) {
      if (lastSeen < cutoff) {
        activeSessions.delete(id);
      }
    }
    res.json({
      onlineCount: Math.max(1, activeSessions.size),
      totalVisitors: totalVisitorsCount,
      serverTime: Date.now()
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

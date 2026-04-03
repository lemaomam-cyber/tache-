import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

process.on("uncaughtException", (err) => {
  console.error("EXCEPTION NON GÉRÉE :", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("REJET NON GÉRÉ à :", promise, "raison :", reason);
});

console.log("--- TEST SERVEUR AVEC LOGS D'ERREUR ---");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  app.get("/api/ping", (req, res) => res.json({ status: "pong" }));

  if (process.env.NODE_ENV !== "production") {
    console.log("Lancement de Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR DE TEST SUR PORT ${PORT} <<<`);
  });

  // Garder le processus en vie de manière robuste
  const keepAlive = setInterval(() => {
    // Ne rien faire, juste garder la boucle d'événements active
  }, 1000 * 60 * 60); // 1 heure
  
  process.on('SIGINT', () => clearInterval(keepAlive));
  process.on('SIGTERM', () => clearInterval(keepAlive));
}

startServer().catch(err => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});

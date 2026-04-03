import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import cors from "cors";

process.on("uncaughtException", (err) => {
  console.error("EXCEPTION NON GÉRÉE :", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("REJET NON GÉRÉ à :", promise, "raison :", reason);
});

console.log("--- DÉMARRAGE DU SERVEUR FULL-STACK ---");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialisation de la base de données SQLite
  console.log("Connexion à SQLite...");
  const db = new Database("database.sqlite");
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Base de données prête.");

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES (DOIVENT ÊTRE AVANT VITE) ---
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "connected" });
  });

  app.get("/api/tasks", (req, res) => {
    try {
      const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
      res.json(tasks);
    } catch (err) {
      console.error("Erreur GET /api/tasks:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/tasks", (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Titre requis" });
    try {
      const info = db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title);
      res.json({ id: info.lastInsertRowid, title, completed: false });
    } catch (err) {
      console.error("Erreur POST /api/tasks:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    try {
      db.prepare("UPDATE tasks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
      res.json({ success: true });
    } catch (err) {
      console.error("Erreur PATCH /api/tasks:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Erreur DELETE /api/tasks:", err);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Lancement de Vite en mode middleware...");
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
    console.log(`>>> SERVEUR OPÉRATIONNEL SUR PORT ${PORT} <<<`);
  });

  // Keep-alive
  const keepAlive = setInterval(() => {}, 1000 * 60 * 60);
  process.on('SIGINT', () => clearInterval(keepAlive));
  process.on('SIGTERM', () => clearInterval(keepAlive));
}

startServer().catch(err => {
  console.error("Erreur fatale au démarrage:", err);
  process.exit(1);
});

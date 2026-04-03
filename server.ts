import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import sqlite3 from "sqlite3";
import cors from "cors";

process.on("uncaughtException", (err) => {
  console.error("!!! EXCEPTION NON GÉRÉE !!!", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("!!! REJET NON GÉRÉ !!! à :", promise, "raison :", reason);
});

console.log("--- DÉMARRAGE DU SERVEUR (Version sqlite3 standard) ---");

async function startServer() {
  const app = express();
  const PORT = 3000;

  console.log("Tentative d'ouverture de la base de données database.sqlite...");
  
  const db = new sqlite3.Database("database.sqlite", (err) => {
    if (err) {
      console.error("ERREUR lors de l'ouverture de la base de données:", err.message);
      return;
    }
    console.log("Connecté à la base de données SQLite.");
    
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (tableErr) => {
      if (tableErr) {
        console.error("ERREUR lors de la création de la table:", tableErr.message);
      } else {
        console.log("Table 'tasks' prête.");
      }
    });
  });

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---
  
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "sqlite3" });
  });

  app.get("/api/tasks", (req, res) => {
    db.all("SELECT * FROM tasks ORDER BY created_at DESC", [], (err, rows) => {
      if (err) {
        console.error("Erreur GET /api/tasks:", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json(rows);
    });
  });

  app.post("/api/tasks", (req, res) => {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Titre requis" });
    
    db.run("INSERT INTO tasks (title) VALUES (?)", [title], function(err) {
      if (err) {
        console.error("Erreur POST /api/tasks:", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ id: this.lastID, title, completed: false });
    });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    
    db.run("UPDATE tasks SET completed = ? WHERE id = ?", [completed ? 1 : 0, id], function(err) {
      if (err) {
        console.error("Erreur PATCH /api/tasks:", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ success: true, changes: this.changes });
    });
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM tasks WHERE id = ?", [id], function(err) {
      if (err) {
        console.error("Erreur DELETE /api/tasks:", err.message);
        return res.status(500).json({ error: "Erreur serveur" });
      }
      res.json({ success: true, changes: this.changes });
    });
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Initialisation de Vite Middleware...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite Middleware chargé.");
    } catch (viteErr) {
      console.error("ERREUR lors du chargement de Vite:", viteErr);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR PRÊT SUR http://localhost:${PORT} <<<`);
  });

  // Keep-alive robuste
  const keepAlive = setInterval(() => {
    // console.log("Pulse...");
  }, 1000 * 60);
  
  process.on('SIGINT', () => {
    db.close();
    clearInterval(keepAlive);
    process.exit(0);
  });
}

console.log("Appel de startServer()...");
startServer().catch(err => {
  console.error("ERREUR FATALE lors de startServer():", err);
  process.exit(1);
});

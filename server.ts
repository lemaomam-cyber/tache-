import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import cors from "cors";

console.log("Initialisation du serveur...");

// Initialisation de la base de données SQLite
const db = new Database("database.sqlite");
console.log("Base de données connectée.");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
console.log("Table 'tasks' vérifiée/créée.");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/tasks", (req, res) => {
    try {
      const tasks = db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur serveur" });
    }
  });

  app.post("/api/tasks", (req, res) => {
    const { title } = req.body;
    if (!title) {
      res.status(400).json({ error: "Le titre est requis" });
      return;
    }
    try {
      const info = db.prepare("INSERT INTO tasks (title) VALUES (?)").run(title);
      res.json({ id: info.lastInsertRowid, title, completed: false });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur serveur" });
    }
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    try {
      const info = db.prepare("UPDATE tasks SET completed = ? WHERE id = ?").run(completed ? 1 : 0, id);
      res.json({ updated: info.changes });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur serveur" });
    }
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const { id } = req.params;
    try {
      const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
      res.json({ deleted: info.changes });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Erreur serveur" });
    }
  });

  // Vite middleware for development
  console.log("NODE_ENV:", process.env.NODE_ENV);
  if (process.env.NODE_ENV !== "production") {
    console.log("Démarrage de Vite en mode middleware (config inline)...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      configFile: false, // Désactive le chargement du fichier vite.config.ts
      plugins: [
        (await import('@vitejs/plugin-react')).default(),
        (await import('@tailwindcss/vite')).default(),
      ],
      define: {
        'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(process.cwd(), '.'),
        },
      },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Erreur fatale lors du démarrage du serveur:", err);
});

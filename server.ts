import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import sqlite3 from "sqlite3";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

process.on("uncaughtException", (err) => {
  console.error("!!! EXCEPTION NON GÉRÉE !!!", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("!!! REJET NON GÉRÉ !!! à :", promise, "raison :", reason);
});

console.log("--- DÉMARRAGE DU SERVEUR (Version Real-Time) ---");

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
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

  // --- SOCKET.IO ---
  io.on("connection", (socket) => {
    console.log("Nouvel utilisateur connecté :", socket.id);
    socket.on("disconnect", () => {
      console.log("Utilisateur déconnecté :", socket.id);
    });
  });

  // --- API ROUTES ---
  
  // ROUTE EXTRÊMEMENT VULNÉRABLE (Utilise db.exec pour permettre les Stacked Queries)
  app.get("/api/tasks/search", (req, res) => {
    const queryParam = req.query.q || "";
    const sql = "SELECT * FROM tasks WHERE title LIKE '%" + queryParam + "%'";
    
    console.log("!!! EXÉCUTION VIA DB.EXEC (Stacked Queries autorisées) !!!");
    console.log("SQL :", sql);
    
    db.exec(sql, (err) => {
      if (err) {
        console.error("Erreur SQL :", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json([]); 
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "sqlite3", realtime: "socket.io" });
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
      const newTask = { id: this.lastID, title, completed: false };
      io.emit("task:created", newTask); // Diffusion temps réel
      res.json(newTask);
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
      io.emit("task:updated", { id: Number(id), completed: !!completed }); // Diffusion temps réel
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
      io.emit("task:deleted", { id: Number(id) }); // Diffusion temps réel
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> SERVEUR PRÊT SUR http://localhost:${PORT} <<<`);
  });

  // Keep-alive robuste
  const keepAlive = setInterval(() => {}, 1000 * 60);
  
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

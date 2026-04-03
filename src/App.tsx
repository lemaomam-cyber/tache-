/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from "react";
import { Plus, CheckCircle2, Circle, Trash2, ListTodo, Loader2, Wifi, WifiOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { io, Socket } from "socket.io-client";
import type { Task } from "./types";

// Initialisation du socket (se connecte au même hôte par défaut)
const socket: Socket = io();

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // Gestion de la connexion socket
    function onConnect() { setIsConnected(true); }
    function onDisconnect() { setIsConnected(false); }

    // Événements temps réel
    function onTaskCreated(newTask: Task) {
      setTasks(prev => {
        if (prev.some(t => t.id === newTask.id)) return prev;
        return [newTask, ...prev];
      });
    }

    function onTaskUpdated({ id, completed }: { id: number, completed: boolean }) {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t));
    }

    function onTaskDeleted({ id }: { id: number }) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("task:created", onTaskCreated);
    socket.on("task:updated", onTaskUpdated);
    socket.on("task:deleted", onTaskDeleted);

    if (searchQuery.trim()) {
      searchTasks(searchQuery);
    } else {
      fetchTasks();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("task:created", onTaskCreated);
      socket.off("task:updated", onTaskUpdated);
      socket.off("task:deleted", onTaskDeleted);
    };
  }, [searchQuery]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tasks");
      if (!response.ok) throw new Error("Erreur lors du chargement des tâches");
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const searchTasks = async (query: string) => {
    try {
      setLoading(true);
      // Appel à l'endpoint vulnérable
      const response = await fetch(`/api/tasks/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTaskTitle }),
      });
      if (!response.ok) throw new Error("Erreur lors de l'ajout");
      const newTask = await response.json();
      setTasks([newTask, ...tasks]);
      setNewTaskTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'ajout");
    }
  };

  const toggleTask = async (id: number, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      if (!response.ok) throw new Error("Erreur lors de la mise à jour");
      
      setTasks(tasks.map(t => t.id === id ? { ...t, completed: !completed } : t));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    }
  };

  const deleteTask = async (id: number) => {
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Erreur lors de la suppression");
      
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-blue-100">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 text-white rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <ListTodo size={32} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-2">
            Mes Tâches
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs font-medium">
            {isConnected ? (
              <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full">
                <Wifi size={12} /> Connecté (Temps Réel)
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <WifiOff size={12} /> Déconnecté
              </span>
            )}
          </div>
          <p className="text-neutral-500 mt-2">
            Gérez votre productivité simplement et efficacement.
          </p>
        </header>

        <form onSubmit={addTask} className="mb-10">
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Ajouter une nouvelle tâche..."
                className="w-full pl-5 pr-14 py-4 bg-white border border-neutral-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-neutral-400"
              />
              <button
                type="submit"
                disabled={!newTaskTitle.trim()}
                className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
              >
                <Plus size={24} />
              </button>
            </div>
            
            <div className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher (Endpoint VULNÉRABLE SQL)..."
                className="w-full px-5 py-3 bg-red-50 border border-red-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition-all placeholder:text-red-300 text-red-900"
              />
              <div className="absolute right-4 top-3 text-red-300 italic text-xs pointer-events-none">
                Labo SQL Injection
              </div>
            </div>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto font-bold">×</button>
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
              <Loader2 className="animate-spin mb-2" size={32} />
              <p>Chargement de vos tâches...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-20 bg-white border border-dashed border-neutral-200 rounded-2xl">
              <p className="text-neutral-400">Aucune tâche pour le moment.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {tasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`group flex items-center gap-4 p-4 bg-white border border-neutral-200 rounded-2xl shadow-sm hover:shadow-md transition-all ${
                    task.completed ? "bg-neutral-50/50" : ""
                  }`}
                >
                  <button
                    onClick={() => toggleTask(task.id, !!task.completed)}
                    className={`flex-shrink-0 transition-colors ${
                      task.completed ? "text-green-500" : "text-neutral-300 hover:text-blue-500"
                    }`}
                  >
                    {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </button>
                  
                  <span
                    className={`flex-grow text-lg transition-all ${
                      task.completed ? "text-neutral-400 line-through" : "text-neutral-700"
                    }`}
                  >
                    {task.title}
                  </span>

                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Supprimer la tâche"
                  >
                    <Trash2 size={20} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <footer className="mt-12 pt-8 border-t border-neutral-100 text-center text-xs text-neutral-400">
          <p>Propulsé par Node.js & SQL • TaskMaster Pro</p>
        </footer>
      </div>
    </div>
  );
}


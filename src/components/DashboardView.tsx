"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import { invalidateGreeting } from "@/lib/greeting-cache";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  source: string;
  date: string;
}

interface HabitCheckin {
  id: string;
  category: string;
  entry: string;
  date: string;
}

interface HabitCategory {
  name: string;
  icon: string;
}

const DEFAULT_CATEGORIES: HabitCategory[] = [
  { name: "Exercise", icon: "🏃" },
  { name: "Reading", icon: "📚" },
  { name: "Learning", icon: "🎓" },
  { name: "Coding", icon: "💻" },
];

export default function DashboardView() {
  const router = useRouter();
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [todoDate, setTodoDate] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [todosExpanded, setTodosExpanded] = useState(false);
  const [greeting, setGreeting] = useState("");
  const [isGreetingLoading, setIsGreetingLoading] = useState(true);

  // Habits
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [categories, setCategories] = useState<HabitCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    setTodoDate(new Date().toISOString().split("T")[0]);
    const saved = localStorage.getItem("buddy-habit-categories");
    if (saved) setCategories(JSON.parse(saved));
  }, []);

  useEffect(() => {
    fetchTodos();
    fetchHabits();
    fetchGreeting();
  }, []);

  // --- Greeting ---

  const GREETING_TTL = 4 * 60 * 60 * 1000; // 4 hours

  const fetchGreeting = async () => {
    // Check cache
    const cached = localStorage.getItem("buddy-greeting");
    if (cached) {
      const { text, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      if (age < GREETING_TTL) {
        setGreeting(text);
        setIsGreetingLoading(false);
        return;
      }
    }

    setIsGreetingLoading(true);
    try {
      const res = await fetch("/api/greeting");
      if (res.ok) {
        const data = await res.json();
        if (data.greeting) {
          setGreeting(data.greeting);
          localStorage.setItem("buddy-greeting", JSON.stringify({
            text: data.greeting,
            timestamp: Date.now(),
          }));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsGreetingLoading(false);
    }
  };

  // --- Habits ---

  const fetchHabits = async () => {
    try {
      const res = await fetch("/api/habits");
      if (res.ok) {
        const data = await res.json();
        setCheckins(data.checkins || []);
      }
    } catch {
      // ignore
    }
  };

  const getTodayCheckins = (category: string): HabitCheckin[] => {
    const today = new Date().toISOString().split("T")[0];
    return checkins.filter((c) => c.category === category && c.date === today);
  };

  const getStreak = (category: string): number => {
    const dates = new Set(
      checkins.filter((c) => c.category === category).map((c) => c.date)
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      if (dates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  // --- Todos ---

  const fetchTodos = async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch {
      // ignore
    }
  };

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newTodo.trim(), date: todoDate }),
      });
      if (res.ok) {
        const data = await res.json();
        setTodos((prev) => [data.todo, ...prev]);
        setNewTodo("");
        invalidateGreeting();
      }
    } catch {
      // ignore
    }
  };

  const toggleTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/todos?id=${id}`, { method: "PATCH" });
      if (res.ok) {
        setTodos((prev) =>
          prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
        );
      }
    } catch {
      // ignore
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/todos?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // ignore
    }
  };

  // --- Summary ---

  const generateSummary = useCallback(async () => {
    setIsSummarizing(true);
    setSummary("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Summary of my day", history: [] }),
      });

      if (!response.ok) {
        const err = await response.json();
        setSummary(`Not enough data: ${err.error || "Try logging a journal or chatting first"}`);
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setSummary((prev) => prev + parsed.text);
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch {
      setSummary("Unable to generate summary. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  // --- Helpers ---

  const formatDate = (dateStr: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === tomorrow) return "Tomorrow";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  };

  const completedToday = categories.filter((c) => getTodayCheckins(c.name).length > 0).length;

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-xs text-muted">Today's overview — habits, todos & summary</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Welcome Greeting */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xl shrink-0">
                🤖
              </div>
              <div className="flex-1 min-w-0">
                {isGreetingLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 bg-card-hover rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-card-hover rounded animate-pulse" />
                  </div>
                ) : greeting ? (
                  <p className="text-sm text-foreground leading-relaxed">{greeting}</p>
                ) : (
                  <p className="text-sm text-muted">Welcome back! Start your day by logging a journal or chatting with Buddy.</p>
                )}
              </div>
            </div>
          </div>

          {/* Habit Summary (compact) */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">
                Habits — {completedToday}/{categories.length} today
              </h3>
              <button
                onClick={() => router.push("/habits")}
                className="text-xs text-accent hover:text-accent-dim transition-colors cursor-pointer"
              >
                Log habits →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const todayEntries = getTodayCheckins(cat.name);
                const streak = getStreak(cat.name);
                const isDone = todayEntries.length > 0;

                return (
                  <div
                    key={cat.name}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${
                      isDone
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-card-hover border-border"
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground">{cat.name}</div>
                      {isDone ? (
                        <div className="text-xs text-muted truncate">
                          {todayEntries[0].entry.replace(`${cat.name}: `, "")}
                        </div>
                      ) : (
                        <div className="text-xs text-muted">
                          {streak > 0 ? `🔥 ${streak} day streak` : "Not logged"}
                        </div>
                      )}
                    </div>
                    {isDone && <span className="text-green-400 text-xs shrink-0">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Todos */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              To-dos
            </h3>

            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <input
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  placeholder="Add a new to-do..."
                  className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  onClick={addTodo}
                  disabled={!newTodo.trim()}
                  className="px-4 py-2 rounded-lg bg-accent text-background text-sm font-medium hover:bg-accent-dim transition-colors disabled:opacity-40 cursor-pointer"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Date:</span>
                <input
                  type="date"
                  value={todoDate}
                  onChange={(e) => setTodoDate(e.target.value)}
                  className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 scheme-dark"
                />
                <button
                  onClick={() => setTodoDate(new Date().toISOString().split("T")[0])}
                  className={`text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    todoDate === new Date().toISOString().split("T")[0]
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() =>
                    setTodoDate(
                      new Date(Date.now() + 86400000).toISOString().split("T")[0]
                    )
                  }
                  className={`text-xs px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    todoDate === new Date(Date.now() + 86400000).toISOString().split("T")[0]
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            </div>

            {(() => {
              const activeTodos = todos.filter((t) => !t.done);
              const doneTodos = todos.filter((t) => t.done);
              const COLLAPSED_LIMIT = 5;
              const visibleActive = todosExpanded
                ? activeTodos
                : activeTodos.slice(0, COLLAPSED_LIMIT);
              const hiddenActiveCount = activeTodos.length - COLLAPSED_LIMIT;

              return (
                <div className="space-y-2">
                  {todos.length === 0 && (
                    <p className="text-sm text-muted text-center py-4">
                      No to-dos yet — add one manually or chat with Buddy to auto-create
                    </p>
                  )}

                  {/* Active todos */}
                  <div className={`space-y-1 ${todosExpanded ? "max-h-96 overflow-y-auto" : ""}`}>
                    {visibleActive.map((todo) => (
                      <TodoItem
                        key={todo.id}
                        todo={todo}
                        onToggle={toggleTodo}
                        onDelete={deleteTodo}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>

                  {/* Show more / less */}
                  {hiddenActiveCount > 0 && (
                    <button
                      onClick={() => setTodosExpanded(!todosExpanded)}
                      className="text-xs text-accent hover:text-accent-dim transition-colors cursor-pointer w-full text-center py-1"
                    >
                      {todosExpanded
                        ? "Show less"
                        : `Show ${hiddenActiveCount} more`}
                    </button>
                  )}

                  {/* Completed toggle */}
                  {doneTodos.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowCompleted(!showCompleted)}
                        className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer flex items-center gap-1 py-1"
                      >
                        <span className={`transition-transform ${showCompleted ? "rotate-90" : ""}`}>
                          ▸
                        </span>
                        {doneTodos.length} completed
                      </button>
                      {showCompleted && (
                        <div className={`space-y-1 ${doneTodos.length > 5 ? "max-h-48 overflow-y-auto" : ""}`}>
                          {doneTodos.map((todo) => (
                            <TodoItem
                              key={todo.id}
                              todo={todo}
                              onToggle={toggleTodo}
                              onDelete={deleteTodo}
                              formatDate={formatDate}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Daily Summary */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">
                Daily Summary
              </h3>
              <button
                onClick={generateSummary}
                disabled={isSummarizing}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSummarizing
                    ? "bg-accent/25 text-accent animate-pulse"
                    : "bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-40"
                }`}
              >
                {isSummarizing ? "Buddy is thinking..." : "Summarize today"}
              </button>
            </div>

            {isSummarizing && !summary ? (
              <div className="flex items-start gap-3 py-4">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-base shrink-0">
                  🤖
                </div>
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-3.5 w-4/5 bg-card-hover rounded animate-pulse" />
                  <div className="h-3.5 w-3/5 bg-card-hover rounded animate-pulse [animation-delay:0.15s]" />
                  <div className="h-3.5 w-2/3 bg-card-hover rounded animate-pulse [animation-delay:0.3s]" />
                </div>
              </div>
            ) : summary ? (
              <div className="text-sm text-foreground leading-relaxed">
                <Markdown content={summary} />
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-6">
                Click &quot;Summarize today&quot; to let Buddy summarize your activities
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
  formatDate,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  formatDate: (date: string) => string;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group ${
        todo.done ? "text-muted line-through" : "text-foreground"
      } hover:bg-card-hover`}
    >
      <button
        onClick={() => onToggle(todo.id)}
        className="flex items-center gap-3 flex-1 cursor-pointer text-left"
      >
        <span
          className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
            todo.done
              ? "bg-accent border-accent text-background"
              : "border-border"
          }`}
        >
          {todo.done && "✓"}
        </span>
        <span className="flex-1">{todo.text}</span>
      </button>
      <span className="text-xs text-muted shrink-0">
        {formatDate(todo.date)}
      </span>
      {todo.source === "ai" && (
        <span className="text-xs text-accent/60 shrink-0">AI</span>
      )}
      <button
        onClick={() => onDelete(todo.id)}
        className="text-xs text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
        title="Delete"
      >
        ✕
      </button>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Markdown from "@/components/Markdown";

interface Todo {
  id: string;
  text: string;
  done: boolean;
  source: string;
  date: string;
}

interface HabitDay {
  date: string;
  done: boolean;
}

interface Habit {
  name: string;
  icon: string;
  history: HabitDay[];
}

const DEFAULT_HABITS: Habit[] = [
  { name: "Exercise", icon: "🏃", history: [] },
  { name: "Reading", icon: "📚", history: [] },
  { name: "Journaling", icon: "✍️", history: [] },
  { name: "Code Review", icon: "💻", history: [] },
];

export default function DashboardView() {
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [newTodo, setNewTodo] = useState("");
  const [todoDate, setTodoDate] = useState("");

  // Load habits from localStorage after mount (avoids hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem("buddy-habits");
    if (saved) setHabits(JSON.parse(saved));
    setTodoDate(new Date().toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    fetchTodos();
  }, []);

  useEffect(() => {
    localStorage.setItem("buddy-habits", JSON.stringify(habits));
  }, [habits]);

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
        setSummary(`ยังไม่มีข้อมูลเพียงพอ: ${err.error || "ลองบันทึก journal หรือแชทก่อนนะ"}`);
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
      setSummary("ไม่สามารถสร้างสรุปได้ ลองอีกครั้ง");
    } finally {
      setIsSummarizing(false);
    }
  }, []);

  const toggleHabit = (habitName: string) => {
    const today = new Date().toISOString().split("T")[0];
    setHabits((prev) =>
      prev.map((h) => {
        if (h.name !== habitName) return h;
        const todayEntry = h.history.find((d) => d.date === today);
        if (todayEntry) {
          return {
            ...h,
            history: h.history.map((d) =>
              d.date === today ? { ...d, done: !d.done } : d
            ),
          };
        }
        return {
          ...h,
          history: [...h.history, { date: today, done: true }],
        };
      })
    );
  };

  const getStreak = (habit: Habit): number => {
    const sorted = [...habit.history]
      .filter((d) => d.done)
      .sort((a, b) => b.date.localeCompare(a.date));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      if (sorted.find((s) => s.date === dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  const isTodayDone = (habit: Habit): boolean => {
    const today = new Date().toISOString().split("T")[0];
    return habit.history.some((d) => d.date === today && d.done);
  };

  const formatDate = (dateStr: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "วันนี้";
    if (dateStr === tomorrow) return "พรุ่งนี้";
    if (dateStr === yesterday) return "เมื่อวาน";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <p className="text-xs text-muted">ภาพรวมวันนี้ — habits, todos & summary</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Habit Tracker */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              Habit Tracker
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {habits.map((habit) => (
                <button
                  key={habit.name}
                  onClick={() => toggleHabit(habit.name)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    isTodayDone(habit)
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-card-hover border-border text-muted hover:text-foreground"
                  }`}
                >
                  <span className="text-2xl">{habit.icon}</span>
                  <div className="text-left">
                    <div className="text-sm font-medium">{habit.name}</div>
                    <div className="text-xs opacity-70">
                      {getStreak(habit) > 0
                        ? `🔥 ${getStreak(habit)} day streak`
                        : "ยังไม่เริ่ม"}
                    </div>
                  </div>
                  {isTodayDone(habit) && (
                    <span className="ml-auto text-green-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Todos */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-foreground mb-4">
              To-dos
            </h3>

            {/* Add todo with date */}
            <div className="space-y-2 mb-4">
              <div className="flex gap-2">
                <input
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  placeholder="เพิ่ม to-do ใหม่..."
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
                <span className="text-xs text-muted">วันที่:</span>
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
                  วันนี้
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
                  พรุ่งนี้
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {todos.length === 0 && (
                <p className="text-sm text-muted text-center py-4">
                  ยังไม่มี to-do — เพิ่มเอง หรือแชทกับ Buddy แล้วจะช่วยสร้างให้
                </p>
              )}
              {todos.map((todo) => (
                <button
                  key={todo.id}
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                    todo.done
                      ? "text-muted line-through"
                      : "text-foreground"
                  } hover:bg-card-hover`}
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
                  <span className="text-left flex-1">{todo.text}</span>
                  <span className="text-xs text-muted shrink-0">
                    {formatDate(todo.date)}
                  </span>
                  {todo.source === "ai" && (
                    <span className="text-xs text-accent/60 shrink-0">AI</span>
                  )}
                </button>
              ))}
            </div>
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
                className="px-4 py-1.5 rounded-lg bg-accent/15 text-accent text-xs font-medium hover:bg-accent/25 transition-colors disabled:opacity-40 cursor-pointer"
              >
                {isSummarizing ? "กำลังสรุป..." : "สรุปวันนี้"}
              </button>
            </div>

            {summary ? (
              <div className="text-sm text-foreground leading-relaxed">
                <Markdown content={summary} />
              </div>
            ) : (
              <p className="text-sm text-muted text-center py-6">
                กดปุ่ม &quot;สรุปวันนี้&quot; เพื่อให้ Buddy สรุปกิจกรรมของคุณ
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

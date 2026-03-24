"use client";

import { useState, useEffect } from "react";
import { invalidateGreeting } from "@/lib/greeting-cache";

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

export default function HabitsView() {
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [categories, setCategories] = useState<HabitCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [entry, setEntry] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const saved = localStorage.getItem("buddy-habit-categories");
    if (saved) setCategories(JSON.parse(saved));
    fetchCheckins();
  }, []);

  const fetchCheckins = async () => {
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

  const saveCheckin = async () => {
    if (!selectedCategory || !entry.trim()) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory,
          entry: entry.trim(),
          date: logDate !== new Date().toISOString().split("T")[0] ? logDate : undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCheckins((prev) => [data.checkin, ...prev]);
        setEntry("");
        setShowDatePicker(false);
        setLogDate(new Date().toISOString().split("T")[0]);
        invalidateGreeting();
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCheckin = async (id: string) => {
    try {
      const res = await fetch(`/api/habits?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCheckins((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      // ignore
    }
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

  const getTodayCount = (category: string): number => {
    const today = new Date().toISOString().split("T")[0];
    return checkins.filter((c) => c.category === category && c.date === today).length;
  };

  const formatDate = (dateStr: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  };

  // Group checkins by date for history view
  const groupedByDate = checkins.reduce<Record<string, HabitCheckin[]>>((acc, c) => {
    if (!acc[c.date]) acc[c.date] = [];
    acc[c.date].push(c);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Habits</h2>
        <p className="text-xs text-muted">Track your daily habits and view history</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Log a habit */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Log a habit</h3>

            {/* Category selector */}
            <div>
              <p className="text-xs text-muted mb-2">Category</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(
                      selectedCategory === cat.name ? "" : cat.name
                    )}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      selectedCategory === cat.name
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-card-hover text-muted hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span className="text-lg">{cat.icon}</span>
                    <span>{cat.name}</span>
                    {getTodayCount(cat.name) > 0 && (
                      <span className="text-green-400 ml-1">
                        ✓{getTodayCount(cat.name) > 1 ? ` x${getTodayCount(cat.name)}` : ""}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Entry input */}
            {selectedCategory && (
              <div className="space-y-3">
                {/* Date selector */}
                {showDatePicker ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Date:</span>
                    <input
                      type="date"
                      value={logDate}
                      onChange={(e) => setLogDate(e.target.value)}
                      className="rounded-lg bg-background border border-border px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50 scheme-dark"
                    />
                    <button
                      onClick={() => {
                        setLogDate(new Date().toISOString().split("T")[0]);
                        setShowDatePicker(false);
                      }}
                      className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
                    >
                      Back to today
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDatePicker(true)}
                    className="text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    Logging for a different day?
                  </button>
                )}

                <textarea
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                  placeholder={`What did you do for ${selectedCategory}?`}
                  rows={3}
                  className="w-full resize-none rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                />

                <button
                  onClick={saveCheckin}
                  disabled={isSaving || !entry.trim()}
                  className="px-5 py-2.5 rounded-lg bg-accent text-background font-medium text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSaving ? "Saving..." : showDatePicker && logDate !== new Date().toISOString().split("T")[0]
                    ? `Save for ${new Date(logDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Streaks overview */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-medium text-foreground mb-3">Streaks</h3>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => {
                const streak = getStreak(cat.name);
                const todayCount = getTodayCount(cat.name);
                return (
                  <div
                    key={cat.name}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      todayCount > 0
                        ? "bg-green-500/10 border-green-500/30"
                        : "bg-card-hover border-border"
                    }`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-foreground">{cat.name}</div>
                      <div className="text-xs text-muted">
                        {streak > 0 ? `🔥 ${streak} day streak` : "Not started"}
                      </div>
                    </div>
                    {todayCount > 0 && (
                      <span className="ml-auto text-green-400 text-sm">✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* History */}
          {sortedDates.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted">History</h3>
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="text-xs font-medium text-muted mb-2">
                    {formatDate(date)}
                  </div>
                  <div className="space-y-2">
                    {groupedByDate[date].map((checkin) => {
                      const cat = categories.find((c) => c.name === checkin.category);
                      return (
                        <div
                          key={checkin.id}
                          className="bg-card rounded-xl border border-border p-3 flex items-start gap-3 group"
                        >
                          <span className="text-lg shrink-0">{cat?.icon || "📌"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-accent font-medium mb-0.5">
                              {checkin.category}
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">
                              {checkin.entry.replace(`${checkin.category}: `, "")}
                            </p>
                          </div>
                          <button
                            onClick={() => deleteCheckin(checkin.id)}
                            className="text-xs text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                            title="Delete"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

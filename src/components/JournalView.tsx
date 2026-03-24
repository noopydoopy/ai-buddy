"use client";

import { useState, useEffect } from "react";
import { invalidateGreeting } from "@/lib/greeting-cache";

interface JournalEntry {
  id: string;
  content: string;
  date: string;
  mood?: string;
}

const MOODS = [
  { emoji: "😊", label: "Good" },
  { emoji: "😐", label: "Okay" },
  { emoji: "😔", label: "Low" },
  { emoji: "😤", label: "Stressed" },
  { emoji: "🔥", label: "Productive" },
  { emoji: "😴", label: "Tired" },
];

export default function JournalView() {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState("");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [todayDate] = useState(() => new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }));

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const res = await fetch("/api/journal");
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch {
      // ignore
    }
  };

  const saveEntry = async () => {
    if (!content.trim()) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), mood }),
      });

      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [data.entry, ...prev]);
        setContent("");
        setMood("");
        invalidateGreeting();
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold">Daily Journal</h2>
        <p className="text-xs text-muted">{todayDate}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* New Entry */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-medium text-foreground">Write today's entry</h3>

            {/* Mood selector */}
            <div>
              <p className="text-xs text-muted mb-2">How are you feeling today?</p>
              <div className="flex gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.label}
                    onClick={() => setMood(mood === m.label ? "" : m.label)}
                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                      mood === m.label
                        ? "bg-accent/15 text-accent border border-accent/30"
                        : "bg-card-hover text-muted hover:text-foreground border border-transparent"
                    }`}
                  >
                    <span className="text-xl">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What did you do today? How do you feel? Anything you want to log?"
              rows={6}
              className="w-full resize-none rounded-lg bg-background border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />

            <button
              onClick={saveEntry}
              disabled={isSaving || !content.trim()}
              className="px-5 py-2.5 rounded-lg bg-accent text-background font-medium text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Past Entries */}
          {entries.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted">Recent entries</h3>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted">
                      {new Date(entry.date).toLocaleString("en-US")}
                    </span>
                    {entry.mood && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-card-hover text-muted">
                        {MOODS.find((m) => m.label === entry.mood)?.emoji} {entry.mood}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {entry.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

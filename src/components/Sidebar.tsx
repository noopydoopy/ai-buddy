"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊", description: "Overview & Summary" },
  { href: "/chat", label: "Chat", icon: "💬", description: "Talk with Buddy" },
  { href: "/journal", label: "Journal", icon: "📓", description: "Daily log" },
  { href: "/habits", label: "Habits", icon: "🎯", description: "Track habits" },
];

interface HealthStatus {
  ollama: boolean;
  chromadb: boolean;
  models: string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="w-64 h-screen bg-card border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h1 className="text-base font-semibold text-foreground">My AI Buddy</h1>
            <p className="text-xs text-muted">Personal Life Assistant</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                isActive
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <div className="text-left">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-70">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Status */}
      <div className="px-5 py-4 border-t border-border">
        <StatusIndicator />
      </div>
    </aside>
  );
}

function StatusIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const checkHealth = () => {
      fetch("/api/health")
        .then((res) => res.json())
        .then(setHealth)
        .catch(() => setHealth(null));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs text-muted">
      <ServiceDot
        service="Ollama"
        status={health === null ? undefined : health.ollama}
      />
      <ServiceDot
        service="ChromaDB"
        status={health === null ? undefined : health.chromadb}
      />
    </div>
  );
}

function ServiceDot({ service, status }: { service: string; status?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          status === true
            ? "bg-green-400"
            : status === false
              ? "bg-red-400"
              : "bg-yellow-400 animate-pulse"
        }`}
      />
      <span>{service}</span>
    </div>
  );
}

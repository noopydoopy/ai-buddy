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
  llm: boolean;
  database: boolean;
  models: string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="w-9 h-9 rounded-lg bg-card-hover flex items-center justify-center text-foreground hover:bg-accent/15 transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <span className="text-sm font-semibold text-foreground">My AI Buddy</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 h-screen bg-card border-r border-border flex flex-col shrink-0
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">My AI Buddy</h1>
              <p className="text-xs text-muted">Personal Life Assistant</p>
            </div>
          </div>
          {/* Close button (mobile only) */}
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            ✕
          </button>
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
    </>
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
        service="LLM"
        status={health === null ? undefined : health.llm}
      />
      <ServiceDot
        service="Database"
        status={health === null ? undefined : health.database}
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

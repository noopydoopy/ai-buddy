"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Markdown from "@/components/Markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SuggestedTodo {
  text: string;
  date: string;
}

interface TodoSuggestion {
  todos: SuggestedTodo[];
  accepted: boolean | null; // null = pending, true = accepted, false = dismissed
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Map<number, TodoSuggestion>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, suggestions, scrollToBottom]);

  const abortStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    abortStream();
    setMessages([]);
    setSuggestions(new Map());
    setInput("");
    inputRef.current?.focus();
  };

  const acceptTodos = async (msgIndex: number) => {
    const suggestion = suggestions.get(msgIndex);
    if (!suggestion || suggestion.accepted !== null) return;

    // Save all todos
    for (const todo of suggestion.todos) {
      try {
        await fetch("/api/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: todo.text, date: todo.date, source: "ai" }),
        });
      } catch {
        // ignore individual failures
      }
    }

    setSuggestions((prev) => {
      const updated = new Map(prev);
      updated.set(msgIndex, { ...suggestion, accepted: true });
      return updated;
    });
  };

  const dismissTodos = (msgIndex: number) => {
    const suggestion = suggestions.get(msgIndex);
    if (!suggestion || suggestion.accepted !== null) return;

    setSuggestions((prev) => {
      const updated = new Map(prev);
      updated.set(msgIndex, { ...suggestion, accepted: false });
      return updated;
    });
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // The assistant message index (for linking suggestions)
    const assistantIndex = messages.length + 1;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-10),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Chat text is done — stop loading indicator
              // but keep reading for late events (todo suggestions)
              setIsLoading(false);
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) =>
                  prev.map((msg, idx) =>
                    idx === prev.length - 1 && msg.role === "assistant"
                      ? { ...msg, content: msg.content + parsed.text }
                      : msg
                  )
                );
              }
              if (parsed.suggestedTodos && parsed.suggestedTodos.length > 0) {
                setSuggestions((prev) => {
                  const updated = new Map(prev);
                  updated.set(assistantIndex, {
                    todos: parsed.suggestedTodos,
                    accepted: null,
                  });
                  return updated;
                });
              }
            } catch {
              // skip
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      const errMsg = error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === prev.length - 1 && msg.role === "assistant"
            ? { ...msg, content: `Error: ${errMsg}` }
            : msg
        )
      );
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDate = (dateStr: string): string => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    if (dateStr === today) return "today";
    if (dateStr === tomorrow) return "tomorrow";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Chat with Buddy</h2>
          <p className="text-xs text-muted">Chat, consult, or log your daily stories</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-foreground hover:bg-card-hover transition-colors cursor-pointer"
          >
            Clear chat
          </button>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Hi! I'm Buddy
              </h2>
              <p className="text-muted max-w-md mx-auto">
                Your personal assistant — ready to log, analyze, and manage your daily life
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {[
                  "How was my day?",
                  "Summary of my day",
                  "Help me plan tomorrow",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-4 py-2 rounded-full bg-card hover:bg-card-hover border border-border text-sm text-foreground transition-colors cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              <div
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-user-bubble text-white rounded-br-md whitespace-pre-wrap"
                      : "bg-ai-bubble text-foreground border border-border rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content ? (
                      <Markdown content={msg.content} />
                    ) : (
                      isLoading && (
                        <span className="inline-flex gap-1">
                          <span className="animate-bounce">.</span>
                          <span className="animate-bounce [animation-delay:0.2s]">.</span>
                          <span className="animate-bounce [animation-delay:0.4s]">.</span>
                        </span>
                      )
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>

              {/* Todo suggestions card */}
              {msg.role === "assistant" && suggestions.has(i) && (
                <TodoSuggestionCard
                  suggestion={suggestions.get(i)!}
                  onAccept={() => acceptTodos(i)}
                  onDismiss={() => dismissTodos(i)}
                  formatDate={formatDate}
                />
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="border-t border-border px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none rounded-xl bg-card border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          {isLoading ? (
            <button
              onClick={abortStream}
              className="px-5 py-3 rounded-xl bg-red-500/80 text-white font-medium text-sm hover:bg-red-500 transition-colors cursor-pointer"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-5 py-3 rounded-xl bg-accent text-background font-medium text-sm hover:bg-accent-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Send
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function TodoSuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  formatDate,
}: {
  suggestion: TodoSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
  formatDate: (date: string) => string;
}) {
  const { todos, accepted } = suggestion;

  return (
    <div className="flex justify-start mt-2">
      <div className="max-w-[80%] rounded-xl bg-card border border-accent/20 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-accent">Tasks detected</span>
        </div>
        <ul className="space-y-1.5 mb-3">
          {todos.map((todo, j) => (
            <li key={j} className="flex items-center gap-2 text-foreground">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-xs ${
                accepted === true
                  ? "bg-accent border-accent text-background"
                  : "border-border"
              }`}>
                {accepted === true && "✓"}
              </span>
              <span className="flex-1">{todo.text}</span>
              <span className="text-xs text-muted shrink-0">{formatDate(todo.date)}</span>
            </li>
          ))}
        </ul>

        {accepted === null ? (
          <div className="flex gap-2">
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-medium hover:bg-accent-dim transition-colors cursor-pointer"
            >
              Add to to-dos
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg bg-card-hover text-muted text-xs font-medium hover:text-foreground transition-colors cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        ) : accepted ? (
          <p className="text-xs text-green-400">Added to your to-dos</p>
        ) : (
          <p className="text-xs text-muted">Dismissed</p>
        )}
      </div>
    </div>
  );
}

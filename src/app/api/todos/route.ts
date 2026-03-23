import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { addLog, getLogsByType, updateLog } from "@/lib/memory";

export async function GET() {
  try {
    const logs = await getLogsByType("todo");
    const todos = logs.documents.map((doc, i) => {
      const meta = logs.metadatas[i] || {};
      return {
        id: meta.id as string,
        text: doc,
        done: meta.done === "true",
        source: (meta.source as string) || "manual",
        date: (meta.date as string) || new Date().toISOString().split("T")[0],
      };
    });

    // Sort: undone first, then by date descending
    todos.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.date.localeCompare(a.date);
    });

    return Response.json({ todos });
  } catch {
    return Response.json({ todos: [] });
  }
}

export async function POST(req: NextRequest) {
  const { text, source = "manual", date } = await req.json();

  if (!text || typeof text !== "string") {
    return Response.json({ error: "Text is required" }, { status: 400 });
  }

  const id = uuidv4();
  const todoDate = date || new Date().toISOString().split("T")[0];
  const timestamp = `${todoDate}T${new Date().toISOString().split("T")[1]}`;

  try {
    await addLog(text.trim(), "todo", {
      id,
      source,
      done: "false",
    }, timestamp);

    return Response.json({
      todo: { id, text: text.trim(), done: false, source, date: todoDate },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to save todo";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  try {
    // Get current state and toggle
    const logs = await getLogsByType("todo");
    const idx = logs.metadatas.findIndex((m) => m.id === id);
    if (idx === -1) {
      return Response.json({ error: "Todo not found" }, { status: 404 });
    }

    const currentDone = logs.metadatas[idx].done === "true";
    await updateLog(id, { done: String(!currentDone) });

    return Response.json({
      todo: {
        id,
        text: logs.documents[idx],
        done: !currentDone,
        source: logs.metadatas[idx].source as string,
        date: logs.metadatas[idx].date as string,
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Failed to update todo";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { chatStream, ChatMessage } from "@/lib/ollama";
import { buildSystemPrompt, buildSummaryPrompt } from "@/lib/prompt";
import { addLog, queryLogs, getTodayLogs } from "@/lib/memory";
import { detectFilters, buildWhereClause } from "@/lib/filter";
import { extractAndSaveTodos } from "@/lib/extract-todos";

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json();

  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  try {
    // Check for special commands
    const isSummary = message.toLowerCase().includes("summary of my day") ||
      message.toLowerCase().includes("summarize today");

    if (isSummary) {
      return handleSummary();
    }

    // Store the user message in memory
    await addLog(message, "chat").catch(() => {
      // ChromaDB might not be running, continue without memory
    });

    // Detect date/type filters from the message
    const filters = detectFilters(message);
    const whereClause = buildWhereClause(filters);

    // Retrieve relevant context from memory
    let context = "";
    try {
      // First: filtered search (if filters detected)
      // Then: broad semantic search as fallback
      const filtered = whereClause
        ? await queryLogs(message, 5, whereClause)
        : { documents: [], metadatas: [] };
      const broad = await queryLogs(message, 5);

      // Merge and deduplicate results, filtered first
      const seen = new Set<string>();
      const allDocs: { doc: string; meta: Record<string, unknown> }[] = [];

      for (const results of [filtered, broad]) {
        results.documents.forEach((doc, i) => {
          if (!seen.has(doc)) {
            seen.add(doc);
            allDocs.push({ doc, meta: results.metadatas[i] });
          }
        });
      }

      if (allDocs.length > 0) {
        context = allDocs
          .slice(0, 8)
          .map(({ doc, meta }) => {
            const type = meta?.type || "unknown";
            const date = meta?.date || meta?.timestamp || "unknown";
            return `[${type}][${date}] ${doc}`;
          })
          .join("\n");
      }
    } catch {
      // ChromaDB might not be running, continue without context
    }

    const systemPrompt = buildSystemPrompt(context || undefined);

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message },
    ];

    // Stream the response
    const stream = await chatStream(messages);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        try {
          for await (const chunk of stream) {
            const text = chunk.message.content;
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }

          // Store assistant response in memory
          await addLog(fullResponse, "chat", { role: "assistant" }).catch(
            () => {}
          );

          // Extract todos from user message (best-effort, non-blocking)
          extractAndSaveTodos(message).catch(() => {});

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

async function handleSummary() {
  try {
    const todayLogs = await getTodayLogs();

    if (todayLogs.documents.length === 0) {
      return Response.json({
        error: "No logs for today yet. Try chatting or writing a journal entry first.",
      }, { status: 400 });
    }

    const summaryPrompt = buildSummaryPrompt(todayLogs.documents);
    const messages: ChatMessage[] = [
      { role: "system", content: summaryPrompt },
      { role: "user", content: "Please summarize my day." },
    ];

    const stream = await chatStream(messages);
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.message.content;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return Response.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}

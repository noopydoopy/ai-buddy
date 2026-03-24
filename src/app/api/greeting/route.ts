import { chat, ChatMessage } from "@/lib/ollama";
import { getTodayLogs } from "@/lib/memory";

export async function GET() {
  try {
    const todayLogs = await getTodayLogs();

    const hasLogs = todayLogs.documents.length > 0;
    const context = hasLogs
      ? todayLogs.documents.slice(0, 5).join("\n")
      : "";

    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are Buddy, a warm personal life assistant. Generate a short welcome greeting (exactly 2 sentences, max 30 words total).

Rules:
- First sentence: a warm greeting appropriate for the ${timeOfDay}
- Second sentence: ${hasLogs
          ? "reference something from the user's recent logs below to show you remember, and offer encouragement or motivation based on their mood/activities"
          : "encourage the user to start their day by logging something"}
- Be warm, concise, and personal
- Do NOT use emojis
- Do NOT use markdown formatting

${hasLogs ? `Recent logs:\n${context}` : ""}`,
      },
      { role: "user", content: "Give me my welcome greeting." },
    ];

    const response = await chat(messages);

    return Response.json({ greeting: response.trim() });
  } catch {
    return Response.json({ greeting: "" });
  }
}

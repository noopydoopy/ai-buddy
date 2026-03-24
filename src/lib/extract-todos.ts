import { chat, ChatMessage } from "./ollama";

function buildExtractPrompt(): string {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  return `You are a task extraction assistant. Analyze the user's message and extract any actionable tasks or to-dos mentioned.

Today is ${todayStr}.

Rules:
- Only extract clear, actionable items (things the user needs to DO)
- Each task should be a short, concise description
- Calculate the correct date based on today's date (${todayStr}) and use ISO format YYYY-MM-DD
- If "tomorrow" is mentioned, use ${tomorrowStr}
- If no specific date is mentioned, leave date empty
- Do NOT extract vague statements, feelings, or observations
- Respond ONLY with a valid JSON array, no other text

Response format:
[{"text": "task description", "date": "YYYY-MM-DD or empty"}]

If no tasks found, respond with: []

Examples:
- "I have a team meeting tomorrow at 10am" → [{"text": "team meeting at 10am", "date": "${tomorrowStr}"}]
- "I exercised today and feel great" → []
- "I need to fix the login bug and deploy to staging tomorrow" → [{"text": "fix the login bug", "date": ""}, {"text": "deploy to staging", "date": "${tomorrowStr}"}]`;
}

export interface ExtractedTodo {
  text: string;
  date: string;
}

/**
 * Extract todos from a message (does NOT save them).
 * Returns an array of extracted todos for user confirmation.
 */
export async function extractTodos(userMessage: string): Promise<ExtractedTodo[]> {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    const messages: ChatMessage[] = [
      { role: "system", content: buildExtractPrompt() },
      {
        role: "user",
        content: `Extract tasks from this message:\n\n"${userMessage}"`,
      },
    ];

    const response = await chat(messages);
    console.log("[extract-todos] LLM raw response:", response);

    // Parse JSON from response — handle cases where LLM wraps in markdown
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log("[extract-todos] No JSON array found in response");
      return [];
    }

    const todos: ExtractedTodo[] = JSON.parse(jsonMatch[0]);
    console.log("[extract-todos] Parsed todos:", JSON.stringify(todos));
    if (!Array.isArray(todos) || todos.length === 0) return [];

    // Clean up and fill defaults
    return todos
      .filter((t) => t.text && typeof t.text === "string")
      .map((t) => ({
        text: t.text.trim(),
        date: t.date || todayStr,
      }));
  } catch {
    return [];
  }
}

import { chat, ChatMessage } from "./ollama";
import { addLog } from "./memory";
import { v4 as uuidv4 } from "uuid";

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

interface ExtractedTodo {
  text: string;
  date: string;
}

export async function extractAndSaveTodos(userMessage: string): Promise<ExtractedTodo[]> {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    const messages: ChatMessage[] = [
      { role: "system", content: buildExtractPrompt() },
      {
        role: "user",
        content: `Extract tasks from this message:\n\n"${userMessage}"`,
      },
    ];

    const response = await chat(messages);

    // Parse JSON from response — handle cases where LLM wraps in markdown
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const todos: ExtractedTodo[] = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(todos) || todos.length === 0) return [];

    // Save each extracted todo to ChromaDB
    const saved: ExtractedTodo[] = [];
    for (const todo of todos) {
      if (!todo.text || typeof todo.text !== "string") continue;

      const id = uuidv4();
      const todoDate = todo.date || todayStr;
      const timestamp = `${todoDate}T${new Date().toISOString().split("T")[1]}`;

      await addLog(todo.text.trim(), "todo", {
        id,
        source: "ai",
        done: "false",
      }, timestamp);

      saved.push({ text: todo.text.trim(), date: todoDate });
    }

    return saved;
  } catch {
    // Extraction is best-effort — don't break chat if it fails
    return [];
  }
}

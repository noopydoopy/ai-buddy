import persona from "./persona.json";

function getCurrentDateTime(): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isoDate = now.toISOString().split("T")[0];
  return `Current date: ${date} (${isoDate}), Time: ${time}`;
}

export function buildSystemPrompt(context?: string): string {
  const base = `You are "${persona.name}", a ${persona.role}.
Personality: ${persona.personality}

${getCurrentDateTime()}

About the user you are assisting:
- Name: ${persona.owner.name}
- Identity: ${persona.owner.identity}
- Core Values: ${persona.owner.coreValues.join(", ")}
- Habits to track: ${persona.owner.habits.join(", ")}
- Communication Style: ${persona.owner.communicationStyle}

Instructions:
${persona.instructions.map((i) => `- ${i}`).join("\n")}
- Address the user by their name "${persona.owner.name}" naturally in conversation to be friendly and personal

Language: ${persona.language}
Always respond in English.
Keep responses concise — aim for 2-4 sentences unless the user asks for detail. Be direct, skip filler.`;

  if (context) {
    return `${base}

=== Relevant context from past conversations ===
${context}
=== End of context ===

Use the above context when relevant to provide personalized, context-aware responses.`;
  }

  return base;
}

export function buildSummaryPrompt(logs: string[]): string {
  return `You are "${persona.name}", a ${persona.role}.
${getCurrentDateTime()}

You MUST summarize ONLY the logs provided below. Do NOT say you have no information. The logs below are the user's actual data for today.

Focus on:
1. Key activities of the day
2. Progress towards goals (${persona.owner.coreValues.join(", ")})
3. Habit tracking (${persona.owner.habits.join(", ")})
4. Actionable suggestions for tomorrow
5. Observable mood/energy patterns

Keep the summary concise — use bullet points where appropriate.

=== TODAY'S LOGS (${logs.length} entries) ===
${logs.map((log, i) => `${i + 1}. ${log}`).join("\n")}
=== END OF LOGS ===

Summarize these ${logs.length} log entries above. Do not ignore them.`;
}

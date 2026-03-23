import persona from "./persona.json";

export function buildSystemPrompt(context?: string): string {
  const base = `You are "${persona.name}", a ${persona.role}.
Personality: ${persona.personality}

About the user:
- Identity: ${persona.owner.identity}
- Core Values: ${persona.owner.coreValues.join(", ")}
- Habits to track: ${persona.owner.habits.join(", ")}
- Communication Style: ${persona.owner.communicationStyle}

Instructions:
${persona.instructions.map((i) => `- ${i}`).join("\n")}

Language: ${persona.language}
Always respond in Thai (mixing English technical terms naturally).`;

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
  return `${buildSystemPrompt()}

Based on the following daily logs, provide a comprehensive daily summary.
Focus on:
1. สรุปกิจกรรมหลักของวัน
2. Progress ต่อเป้าหมาย (${persona.owner.coreValues.join(", ")})
3. Habit tracking (${persona.owner.habits.join(", ")})
4. Actionable suggestions สำหรับพรุ่งนี้
5. Mood/Energy pattern ที่สังเกตได้

=== Today's Logs ===
${logs.join("\n---\n")}
=== End of Logs ===

Please provide the summary in Thai (mix English technical terms).`;
}

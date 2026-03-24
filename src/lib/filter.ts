/**
 * Detects date and type filters from user messages.
 * Returns ChromaDB-compatible where clauses.
 */

interface DetectedFilter {
  dates: string[];
  dateRange: { from: string; to: string } | null;
  types: string[];
}

export function detectFilters(message: string): DetectedFilter {
  const result: DetectedFilter = {
    dates: [],
    dateRange: null,
    types: [],
  };

  const lower = message.toLowerCase();
  const today = new Date();

  // --- Date detection ---

  if (lower.includes("today") || lower.includes("right now")) {
    result.dates.push(formatDate(today));
  }

  if (lower.includes("yesterday")) {
    result.dates.push(formatDate(daysAgo(1)));
  }

  if (lower.includes("day before yesterday")) {
    result.dates.push(formatDate(daysAgo(2)));
  }

  if (lower.includes("tomorrow")) {
    result.dates.push(formatDate(daysFromNow(1)));
  }

  // This week
  if (lower.includes("this week")) {
    const monday = getMonday(today);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    result.dateRange = { from: formatDate(monday), to: formatDate(sunday) };
  }

  // Last week
  if (lower.includes("last week")) {
    const lastMonday = getMonday(today);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastSunday.getDate() + 6);
    result.dateRange = {
      from: formatDate(lastMonday),
      to: formatDate(lastSunday),
    };
  }

  // N days ago: "3 days ago"
  const daysAgoMatch = lower.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    result.dates.push(formatDate(daysAgo(n)));
  }

  // Last N days: "last 5 days"
  const lastNDaysMatch = lower.match(/last\s*(\d+)\s*days?/);
  if (lastNDaysMatch) {
    const n = parseInt(lastNDaysMatch[1]);
    result.dateRange = {
      from: formatDate(daysAgo(n - 1)),
      to: formatDate(today),
    };
  }

  // This month
  if (lower.includes("this month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    result.dateRange = { from: formatDate(firstDay), to: formatDate(today) };
  }

  // --- Type detection ---

  if (
    lower.includes("journal") ||
    lower.includes("diary") ||
    lower.includes("log entry")
  ) {
    result.types.push("journal");
  }

  if (
    lower.includes("todo") ||
    lower.includes("to-do") ||
    lower.includes("task")
  ) {
    result.types.push("todo");
  }

  if (
    lower.includes("chat") ||
    lower.includes("conversation") ||
    lower.includes("talked about")
  ) {
    result.types.push("chat");
  }

  return result;
}

/**
 * Builds a ChromaDB where clause from detected filters.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildWhereClause(filters: DetectedFilter): any | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: any[] = [];

  // Date conditions
  if (filters.dates.length === 1) {
    conditions.push({ date: filters.dates[0] });
  } else if (filters.dates.length > 1) {
    conditions.push({ date: { $in: filters.dates } });
  }

  if (filters.dateRange) {
    conditions.push({ date: { $gte: filters.dateRange.from } });
    conditions.push({ date: { $lte: filters.dateRange.to } });
  }

  // Type conditions
  if (filters.types.length === 1) {
    conditions.push({ type: filters.types[0] });
  } else if (filters.types.length > 1) {
    conditions.push({ type: { $in: filters.types } });
  }

  // Combine
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

// --- Helpers ---

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

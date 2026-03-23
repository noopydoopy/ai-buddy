/**
 * Detects date and type filters from user messages (Thai + English).
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

  // Today
  if (
    lower.includes("วันนี้") ||
    lower.includes("today") ||
    lower.includes("ตอนนี้")
  ) {
    result.dates.push(formatDate(today));
  }

  // Yesterday
  if (
    lower.includes("เมื่อวาน") ||
    lower.includes("yesterday") ||
    lower.includes("เมื่อวานนี้")
  ) {
    result.dates.push(formatDate(daysAgo(1)));
  }

  // Day before yesterday
  if (lower.includes("เมื่อวานซืน") || lower.includes("day before yesterday")) {
    result.dates.push(formatDate(daysAgo(2)));
  }

  // Tomorrow
  if (lower.includes("พรุ่งนี้") || lower.includes("tomorrow")) {
    result.dates.push(formatDate(daysFromNow(1)));
  }

  // This week
  if (
    lower.includes("สัปดาห์นี้") ||
    lower.includes("อาทิตย์นี้") ||
    lower.includes("this week") ||
    lower.includes("wk นี้")
  ) {
    const monday = getMonday(today);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    result.dateRange = { from: formatDate(monday), to: formatDate(sunday) };
  }

  // Last week
  if (
    lower.includes("สัปดาห์ที่แล้ว") ||
    lower.includes("อาทิตย์ที่แล้ว") ||
    lower.includes("last week")
  ) {
    const lastMonday = getMonday(today);
    lastMonday.setDate(lastMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastSunday.getDate() + 6);
    result.dateRange = {
      from: formatDate(lastMonday),
      to: formatDate(lastSunday),
    };
  }

  // N days ago: "3 วันก่อน", "3 days ago"
  const daysAgoMatch =
    lower.match(/(\d+)\s*วันก่อน/) || lower.match(/(\d+)\s*days?\s*ago/);
  if (daysAgoMatch) {
    const n = parseInt(daysAgoMatch[1]);
    result.dates.push(formatDate(daysAgo(n)));
  }

  // Last N days: "5 วันที่ผ่านมา", "last 5 days"
  const lastNDaysMatch =
    lower.match(/(\d+)\s*วันที่ผ่านมา/) ||
    lower.match(/last\s*(\d+)\s*days?/) ||
    lower.match(/(\d+)\s*วันล่าสุด/);
  if (lastNDaysMatch) {
    const n = parseInt(lastNDaysMatch[1]);
    result.dateRange = {
      from: formatDate(daysAgo(n - 1)),
      to: formatDate(today),
    };
  }

  // This month
  if (lower.includes("เดือนนี้") || lower.includes("this month")) {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    result.dateRange = { from: formatDate(firstDay), to: formatDate(today) };
  }

  // --- Type detection ---

  if (
    lower.includes("journal") ||
    lower.includes("บันทึก") ||
    lower.includes("ไดอารี่") ||
    lower.includes("diary")
  ) {
    result.types.push("journal");
  }

  if (
    lower.includes("todo") ||
    lower.includes("to-do") ||
    lower.includes("สิ่งที่ต้องทำ") ||
    lower.includes("งาน") ||
    lower.includes("task")
  ) {
    result.types.push("todo");
  }

  if (
    lower.includes("แชท") ||
    lower.includes("chat") ||
    lower.includes("คุย") ||
    lower.includes("พูดคุย") ||
    lower.includes("conversation")
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

export const isClockTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function localDateKey(at: number): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Use local calendar days rather than adding 24h, including DST transitions. */
export function nextDailyOccurrence(time: string, now: number, consumedDate: string | null): number {
  if (!isClockTime(time)) throw new Error('请选择有效的每日关机时间');
  const date = new Date(now);
  date.setHours(Number(time.slice(0, 2)), Number(time.slice(3)), 0, 0);
  if (date.getTime() - now < 300_000) date.setDate(date.getDate() + 1);
  if (consumedDate && localDateKey(date.getTime()) <= consumedDate) {
    const consumed = new Date(`${consumedDate}T12:00:00`);
    consumed.setDate(consumed.getDate() + 1);
    consumed.setHours(Number(time.slice(0, 2)), Number(time.slice(3)), 0, 0);
    return consumed.getTime();
  }
  return date.getTime();
}

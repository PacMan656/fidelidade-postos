/** Datas no fuso de Brasília: "dia" de oferta, fim do dia e janelas de agendamento. */
export const TZ = "America/Sao_Paulo";

const parts = (d: Date) => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  return o;
};

/** "2026-10-16" no horário de Brasília */
export function dayKey(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function hourInTz(d: Date = new Date()): number {
  return Number(parts(d).hour) % 24;
}

/** Diferença entre o fuso e UTC em minutos para a data (Brasília: −180, sem horário de verão desde 2019). */
function tzOffsetMinutes(d: Date): number {
  const p = parts(d);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return Math.round((asUtc - d.getTime()) / 60000);
}

/** Instante em que o relógio de Brasília marca `hour:00` no mesmo dia de `d`. */
export function atHourInTz(d: Date, hour: number): Date {
  const [y, m, day] = dayKey(d).split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, day, hour, 0));
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d.getTime());
  x.setUTCMonth(x.getUTCMonth() + months);
  return x;
}

/** "YYYY-MM" para limites mensais (RN-29) */
export function monthKey(d: Date = new Date()): string {
  return dayKey(d).slice(0, 7);
}

/** Dia da semana em Brasília (0 = domingo) */
export function weekdayInTz(d: Date): number {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts(d).weekday);
}

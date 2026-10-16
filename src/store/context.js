import { createContext, useCallback, useRef, useState } from "react";

export const Ctx = createContext(null);

export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const flash = useCallback((m, tone = "ok") => {
    clearTimeout(timer.current);
    setToast({ m, tone });
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return { toast, flash };
}

/** RN-25: nível pelos pontos acumulados na vida (no modo demonstração, pelo saldo) */
export function computeLevel(config, s) {
  const base = s.lifetimePoints ?? s.points ?? 0;
  const levels = [...(config.levels || [])].sort((a, b) => a.min - b.min);
  if (!levels.length) return { name: "", next: null, faltam: 0, fill: 0, all: [] };
  let i = 0;
  levels.forEach((l, idx) => { if (base >= l.min) i = idx; });
  const cur = levels[i], next = levels[i + 1];
  return {
    name: cur.name, next: next?.name, faltam: next ? next.min - base : 0,
    fill: next ? Math.round(((base - cur.min) / (next.min - cur.min)) * 100) : 100, all: levels.map((l) => l.name),
  };
}


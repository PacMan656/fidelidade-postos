/* Paleta ativa. É mutável: applyBrand() troca os valores quando a configuração da rede chega,
   e o ConfigProvider re-renderiza a árvore, então quem lê `c.*` sempre pega a cor da rede atual. */
export const c = {
  ink: "#2A080E",
  inkSoft: "#43101A",
  brand: "#D81E2C",
  brandDeep: "#A8121F",
  wordmark: "#7A1019",
  yellow: "#FFC21A", // cor de destaque (pontos)
  cream: "#FBF5EC",
  paper: "#FFFFFF",
  line: "#ECE3D5",
  muted: "#8A7A70",
  ink2: "#3A1219",
  green: "#2E9E5B",
  danger: "#C0182B",
  pinkSoft: "#FCE7E9",
  amberSoft: "#FFF6E2",
  onInk0: "#dcc3c8",
  onInk1: "#caa6ad",
  onInk2: "#b08c92",
  onBrand: "#ffe0c9",
  barTrack: "#43151d",
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
/** mistura a cor `a` com `b` na proporção t (0 = a, 1 = b) */
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const rgba = (h, a) => `rgba(${hex(h).join(",")},${a})`;

export function applyBrand(colors) {
  const k = { ...colors };
  Object.assign(c, {
    brand: k.brand, brandDeep: k.brandDeep, wordmark: k.wordmark || k.brandDeep,
    ink: k.ink, inkSoft: k.inkSoft || mix(k.ink, "#ffffff", 0.08),
    yellow: k.accent, cream: k.cream,
    line: mix(k.cream, k.ink, 0.08),
    muted: mix(k.ink, k.cream, 0.5),
    ink2: mix(k.ink, "#ffffff", 0.06),
    pinkSoft: mix(k.brand, "#ffffff", 0.89),
    amberSoft: mix(k.accent, "#ffffff", 0.88),
    onInk0: mix(k.ink, "#ffffff", 0.78),
    onInk1: mix(k.ink, "#ffffff", 0.65),
    onInk2: mix(k.ink, "#ffffff", 0.55),
    onBrand: mix(k.brand, "#ffffff", 0.82),
    barTrack: mix(k.ink, "#ffffff", 0.1),
  });
  const r = document.documentElement.style;
  const vars = {
    "--ink": c.ink, "--ink-soft": c.inkSoft, "--brand": c.brand, "--brand-deep": c.brandDeep, "--wordmark": c.wordmark,
    "--yellow": c.yellow, "--cream": c.cream, "--line": c.line, "--muted": c.muted,
    "--pink-soft": c.pinkSoft, "--amber-soft": c.amberSoft, "--bar-track": c.barTrack,
    "--shadow-ink": rgba(c.ink, 0.7), "--shadow-brand": rgba(c.brandDeep, 0.7), "--focus": rgba(c.brand, 0.12),
    "--page-bg": mix(c.cream, c.ink, 0.07),
  };
  for (const [n, v] of Object.entries(vars)) r.setProperty(n, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.brand);
}

export const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (n) => Number(n || 0).toLocaleString("pt-BR");

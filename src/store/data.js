import { Wrench, Droplets, Gauge, Car } from "lucide-react";

export const maintIcons = { oleo: Droplets, alinhamento: Gauge, filtro: Wrench, calibragem: Car };

/** Estado inicial (dados de demonstração do usuário). Catálogo, preços e textos vêm da configuração da rede. */
export function makeInitialState(config) {
  const first = Object.keys(config.fuelPrices)[0];
  const fr = Object.fromEntries((config.campaign?.items || []).map((it, i) => [it.key, [14, 6, 9, 5][i] ?? 3]));
  return {
    ...initialState,
    banked: config.features?.priceLock ? [{ fuel: first, liters: 20, price: +(config.fuelPrices[first] * 0.98).toFixed(2), date: "12/06" }] : [],
    staff: { name: "Carlos", station: config.stations?.[0] || "Matriz" },
    fr,
    tx: initialState.tx.map((t) => ({ ...t, t: t.t.replace("Posto Centro", `Posto ${config.stations?.[0] || ""}`.trim()) })),
  };
}

const initialState = {
  session: null, // { role: "cliente" | "frentista" }
  user: { name: "Elísio", fullName: "Elísio Andrade", cpf: "•••.•••.443-08", phone: "(11) 9 8765-4321", email: "elisio@email.com" },
  car: { model: "Fiat Argo 1.0", plate: "ABC-1D23", km: 42350, kmMonth: 1180 },
  points: 3480,
  prepaid: 75,
  offerActive: false,
  cards: [{ id: "c1", brand: "Visa", last4: "6411", kind: "Crédito" }],
  tx: [
    { t: "Abastecimento · Posto Centro", d: "Hoje, 08:14", v: 240, kind: "in" },
    { t: "Conveniência · 2 itens", d: "Hoje, 08:15", v: 60, kind: "in" },
    { t: "Resgate · Troca de óleo", d: "15/06", v: -3000, kind: "out" },
    { t: "Bônus de boas-vindas", d: "10/06", v: 200, kind: "in" },
  ],
  vouchers: [],
  coupons: [],
  banked: [{ fuel: "Gasolina", liters: 20, price: 6.17, date: "12/06" }],
  maint: [
    { id: "oleo", name: "Troca de óleo", status: "proxima", detail: "Faltam ~600 km", pct: 92, bonus: true, scheduled: null },
    { id: "alinhamento", name: "Alinhamento e balanceamento", status: "proxima", detail: "Estimado em ~3 semanas", pct: 78, bonus: true, scheduled: null },
    { id: "filtro", name: "Filtro de ar", status: "emdia", detail: "Trocado há 2.000 km", pct: 35, bonus: false, scheduled: null },
    { id: "calibragem", name: "Calibragem dos pneus", status: "dica", detail: "Grátis a cada abastecimento", pct: 0, bonus: false, scheduled: null },
  ],
  notifications: [
    { id: "n1", t: "Oferta de hoje liberada", b: "Desconto por litro liberado hoje. Ative na tela inicial.", d: "Hoje, 07:00", read: false, kind: "oferta" },
    { id: "n2", t: "180 pontos vão expirar", b: "Use seus pontos nos próximos 12 dias para não perdê-los.", d: "Ontem", read: false, kind: "alerta" },
    { id: "n3", t: "Troca de óleo chegando", b: "Pela sua média, faltam ~600 km. Agende e ganhe 2× pontos.", d: "14/06", read: true, kind: "manutencao" },
  ],
  // frentista
  staff: { name: "Carlos", station: "Posto Centro" },
  fr: { cadastros: 14, trocas: 6, aditivos: 9, lavagens: 5 },
};

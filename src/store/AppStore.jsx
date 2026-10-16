import React, { useContext, useEffect, useMemo, useState } from "react";
import { Ctx, useToast, computeLevel } from "./context";
import { makeInitialState } from "./data";
import { useConfig } from "../config/ConfigProvider";
import { firebaseEnabled } from "../services/firebase";
import { cardBrand, luhnOk } from "../services/payments";
import { FirebaseStore } from "./FirebaseStore";
import { brl, num } from "../theme";

export function AppProvider({ children, preview = false }) {
  return firebaseEnabled && !preview ? <FirebaseStore>{children}</FirebaseStore> : <DemoStore preview={preview}>{children}</DemoStore>;
}

export const useApp = () => useContext(Ctx);
export { num };
export { computeLevel };

/* ------------------------------------------------------------------ */
/* Modo demonstração: tudo no navegador, sem backend                   */
/* ------------------------------------------------------------------ */

function load(key, initial) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...initial, ...JSON.parse(raw) };
  } catch (e) {}
  return initial;
}

const nowLabel = () => {
  const d = new Date();
  return `Hoje, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const code = (p) => `${p}-` + Math.random().toString(36).slice(2, 6).toUpperCase();
const DEMO_BOARD = [{ name: "Marina S.", val: 240 }, { name: "João P.", val: 150 }, { name: "Pedro L.", val: 120 }];

function DemoStore({ children, preview }) {
  const { config, tenantId } = useConfig();
  const KEY = `app-state-${tenantId}`;
  // na pré-visualização do painel: entra direto como cliente e não grava nada
  const [s, setS] = useState(() => (preview ? { ...makeInitialState(config), session: { role: "cliente" } } : load(KEY, makeInitialState(config))));
  const { toast, flash } = useToast();

  useEffect(() => {
    if (preview) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }, [s, KEY, preview]);

  const patch = (fn) => setS((p) => ({ ...p, ...fn(p) }));
  const mult = config.points?.appMultiplier || 1;
  const perReal = config.points?.perReal || 1;
  const fail = (m) => { flash(m, "err"); return null; };

  const actions = useMemo(() => ({
    login: (role) => patch(() => ({ session: { role } })),
    logout: () => patch(() => ({ session: null })),
    reset: () => { setS({ ...makeInitialState(config), session: s.session }); flash("Dados de demonstração restaurados"); },

    activateOffer: async () => { patch((p) => (p.offerActive ? {} : { offerActive: true })); return true; },

    redeem: async (r) => {
      if (s.points < r.cost) return fail("Pontos insuficientes para este resgate");
      const v = { code: Math.random().toString(36).slice(2, 10).toUpperCase(), rewardId: r.id, name: r.name, date: nowLabel(), status: "ativo" };
      patch((p) => ({ points: p.points - r.cost, tx: [{ t: `Resgate · ${r.name}`, d: "Agora", v: -r.cost, kind: "out" }, ...p.tx], vouchers: [v, ...p.vouchers] }));
      return v;
    },

    startPix: async (amount) => {
      const a = Number(amount) || 0;
      if (a < (config.wallet?.minCredit ?? 1)) return fail(`Recarga mínima de ${brl(config.wallet?.minCredit ?? 1)}`);
      return { txid: "demo", brCode: config.pix?.payload, pixKey: config.pix?.key, amountCents: Math.round(a * 100), demo: true };
    },
    confirmPixDemo: async (amount) => {
      const a = Number(amount) || 0;
      patch((p) => ({ prepaid: p.prepaid + a }));
      flash(`Pix confirmado · ${brl(a)} na carteira`);
      return true;
    },
    watchPix: () => () => {},
    creditCard: async (amount) => {
      const a = Number(amount) || 0;
      if (a <= 0) return fail("Informe um valor válido");
      patch((p) => ({ prepaid: p.prepaid + a }));
      flash(`${brl(a)} adicionados à carteira`);
      return true;
    },

    addCard: async (cf) => {
      const digits = cf.num.replace(/\D/g, "");
      if (!luhnOk(digits)) return fail("Número de cartão inválido");
      if (!cf.name.trim()) return fail("Informe o nome impresso no cartão");
      if (!/^\d{2}\/\d{2}$/.test(cf.val)) return fail("Validade no formato MM/AA");
      if (!/^\d{3,4}$/.test(cf.cvv)) return fail("CVV inválido");
      patch((p) => ({ cards: [...p.cards, { id: code("c"), brand: cardBrand(digits), last4: digits.slice(-4), kind: cf.kind }] }));
      flash("Cartão adicionado");
      return true;
    },
    setMainCard: async (id) => patch((p) => ({ cards: [...p.cards.filter((x) => x.id === id), ...p.cards.filter((x) => x.id !== id)] })),
    removeCard: async (id) => { patch((p) => ({ cards: p.cards.filter((x) => x.id !== id) })); flash("Cartão removido"); },

    pay: async (amount, method) => {
      const a = Number(amount) || 0;
      if (a <= 0) return fail("Informe o valor do abastecimento");
      if (method === "prepaid" && s.prepaid < a) return fail("Saldo da carteira insuficiente");
      const pts = Math.floor(a * perReal * mult);
      patch((p) => ({
        prepaid: method === "prepaid" ? p.prepaid - a : p.prepaid,
        points: p.points + pts,
        tx: [{ t: `Pagamento pelo app${mult > 1 ? ` · pontos ${mult}×` : ""}`, d: "Agora", v: pts, kind: "in" }, ...p.tx],
      }));
      return { amount: a, pts, auth: code("AUT") };
    },

    lockPrice: async (fuel, liters) => {
      const l = Number(liters) || 0;
      if (l <= 0) return fail("Escolha quantos litros travar");
      const price = config.fuelPrices[fuel];
      if (s.prepaid < l * price) return fail(`Saldo insuficiente: a trava custa ${brl(l * price)}. Adicione crédito à carteira.`);
      patch((p) => ({ prepaid: p.prepaid - l * price, banked: [{ fuel, liters: l, price, date: "Agora" }, ...p.banked] }));
      flash(`${l} L de ${fuel} travados a ${brl(price)}/L`);
      return true;
    },

    scheduleMaint: async (id, slot) => {
      patch((p) => ({ maint: p.maint.map((x) => (x.id === id ? { ...x, scheduled: slot.label } : x)) }));
      flash("Serviço agendado");
      return true;
    },

    saveCoupon: async (partner) => {
      if (s.coupons.some((x) => x.partnerId === partner.id)) { flash("Cupom já está na sua carteira"); return; }
      patch((p) => ({ coupons: [{ partnerId: partner.id, code: code("CL") }, ...p.coupons] }));
      flash("Cupom guardado na carteira");
    },

    readAll: () => patch((p) => ({ notifications: p.notifications.map((n) => ({ ...n, read: true })) })),
    readOne: (id) => patch((p) => ({ notifications: p.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    updateCar: async (car) => { patch((p) => ({ car: { ...p.car, ...car } })); flash("Veículo atualizado"); return true; },
    issueCheckin: async () => ({ token: `DEMO.${tenantId}.${Date.now().toString(36)}`, expiresAt: new Date(Date.now() + 300000).toISOString() }),

    /* equipe */
    lookupCustomer: async () => ({ name: s.user.fullName, cpfMasked: s.user.cpf, level: computeLevel(config, s).name, points: s.points, offerActive: s.offerActive, lockedByFuel: {} }),
    registerSale: async (sale) => {
      const keys = new Set((config.campaign?.items || []).map((i) => i.key));
      const items = (sale.items || []).filter((k) => keys.has(k));
      patch((p) => {
        const fr = { ...p.fr };
        items.forEach((k) => { fr[k] = (fr[k] || 0) + 1; });
        return { fr };
      });
      const paid = Math.round((Number(sale.amount) || 0) * 100);
      return { paidCents: paid, points: sale.identified ? Math.floor((paid / 100) * perReal) : 0, offerDiscountCents: 0, lockValueCents: 0 };
    },
    validateVoucher: async (vcode, confirm) => {
      const v = s.vouchers.find((x) => x.code.replace(/[^A-Z0-9]/g, "") === vcode.replace(/[^A-Z0-9]/g, ""));
      if (!v) return fail("Voucher não encontrado");
      if (v.status === "usado") return fail("Este voucher já foi utilizado");
      if (confirm) patch((p) => ({ vouchers: p.vouchers.map((x) => (x.code === v.code ? { ...x, status: "usado" } : x)) }));
      return { code: v.code, rewardName: v.name, customerName: s.user.fullName, valid: true, used: !!confirm };
    },
  }), [s, flash, config, tenantId]);

  const level = useMemo(() => computeLevel(config, s), [s, config]);

  // campanha e ranking no formato que as telas do frentista usam
  const items = config.campaign?.items || [];
  const bonusCents = items.reduce((a, it) => a + (s.fr[it.key] || 0) * Math.round(it.reward * 100), 0);
  const view = {
    ...s,
    campaign: { bonusCents, sales: 0, identifiedSales: 0, identPct: 64 },
    ranking: [...DEMO_BOARD, { name: `Você (${s.staff.name})`, val: bonusCents / 100, me: true }].sort((a, b) => b.val - a.val),
  };

  const value = useMemo(() => ({ s: view, level, toast, flash, mode: "demo", ...actions }), [view, level, toast, flash, actions]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

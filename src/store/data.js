import {
  Wrench, Droplets, Gauge, Fuel, Coffee, ShoppingBag, Car, Plus, Utensils, Dumbbell, Wallet,
} from "lucide-react";

export const fuelPrices = { Gasolina: 6.29, Etanol: 4.49, Diesel: 6.09 };

export const LEVELS = [
  { name: "Bronze", min: 0 },
  { name: "Prata", min: 1500 },
  { name: "Ouro", min: 3000 },
  { name: "Diamante", min: 4000 },
];

export const rewards = [
  { id: "oleo", name: "Troca de óleo", cat: "Serviço auto", cost: 3000, Icon: Wrench, hue: "#D81E2C",
    desc: "Troca de óleo do motor com óleo sintético 5W30 (até 4 L) e mão de obra inclusa." },
  { id: "lavagem", name: "Lavagem completa", cat: "Serviço", cost: 1500, Icon: Droplets, hue: "#2C82C9",
    desc: "Lavagem externa, aspiração interna, pretinho nos pneus e secagem." },
  { id: "checkup", name: "Calibragem + check-up", cat: "Serviço auto", cost: 600, Icon: Gauge, hue: "#8A5BD6",
    desc: "Calibragem dos 4 pneus e estepe, verificação de fluidos, palhetas e luzes." },
  { id: "aditivo", name: "Aditivo de combustível", cat: "Produto", cost: 800, Icon: Fuel, hue: "#E08A1E",
    desc: "Um frasco de aditivo limpador do sistema de injeção, aplicado no abastecimento." },
  { id: "cafe", name: "Café + snack", cat: "Conveniência", cost: 400, Icon: Coffee, hue: "#C0703B",
    desc: "Um café expresso médio e um salgado ou snack à sua escolha na conveniência." },
  { id: "vale10", name: "Vale R$ 10 na loja", cat: "Conveniência", cost: 1000, Icon: ShoppingBag, hue: "#D45B86",
    desc: "Crédito de R$ 10 para usar em qualquer produto da loja de conveniência." },
];

export const partners = [
  { id: "farmacia", name: "Farmácia Saúde+", offer: "15% de desconto", Icon: Plus, hue: "#2C82C9",
    address: "Rua das Flores, 120 · Centro", rules: "Válido em medicamentos e perfumaria. Não cumulativo com outras promoções." },
  { id: "restaurante", name: "Restaurante Sabor da Praça", offer: "Sobremesa grátis", Icon: Utensils, hue: "#C0703B",
    address: "Praça da Matriz, 45", rules: "Na compra de um prato executivo. De segunda a sexta, no almoço." },
  { id: "autocenter", name: "Auto Center Lima", offer: "20% em peças", Icon: Car, hue: "#A8121F",
    address: "Av. Rodoviária, 900", rules: "Desconto em peças de reposição. Mão de obra cobrada à parte." },
  { id: "academia", name: "Academia Corpo Ativo", offer: "1ª mensalidade grátis", Icon: Dumbbell, hue: "#8A5BD6",
    address: "Rua Sete de Setembro, 310", rules: "Para novos alunos, no plano anual. Apresente o cupom na recepção." },
];

export const missions = [
  { id: "abastece3", t: "Abasteça 3× nesta semana", reward: "+300 pts", prog: 66, Icon: Fuel },
  { id: "carteira", t: "Pague pela Carteira Dona Rosa", reward: "Pontos 2×", prog: 0, Icon: Wallet },
  { id: "lavagem", t: "Experimente a lavagem", reward: "Cupom 30% off", prog: 0, Icon: Droplets },
];

export const maintIcons = { oleo: Droplets, alinhamento: Gauge, filtro: Wrench, calibragem: Car };

export const initialState = {
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
    { id: "n1", t: "Oferta de hoje liberada", b: "R$ 0,20 de desconto por litro até 23h. Ative na tela inicial.", d: "Hoje, 07:00", read: false, kind: "oferta" },
    { id: "n2", t: "180 pontos vão expirar", b: "Use seus pontos nos próximos 12 dias para não perdê-los.", d: "Ontem", read: false, kind: "alerta" },
    { id: "n3", t: "Troca de óleo chegando", b: "Pela sua média, faltam ~600 km. Agende e ganhe 2× pontos.", d: "14/06", read: true, kind: "manutencao" },
  ],
  // frentista
  staff: { name: "Carlos", station: "Posto Centro" },
  fr: { cadastros: 14, trocas: 6, aditivos: 9, lavagens: 5 },
};

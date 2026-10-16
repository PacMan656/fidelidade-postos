/* ---------- Dona Rosa · vermelho + amarelo ---------- */
export const c = {
  ink: "#2A080E",
  inkSoft: "#43101A",
  brand: "#D81E2C",
  brandDeep: "#A8121F",
  wordmark: "#7A1019",
  yellow: "#FFC21A",
  yellowSoft: "#FFD75E",
  cream: "#FBF5EC",
  paper: "#FFFFFF",
  line: "#ECE3D5",
  muted: "#8A7A70",
  ink2: "#3A1219",
  green: "#2E9E5B",
  danger: "#C0182B",
  pinkSoft: "#FCE7E9",
  amberSoft: "#FFF6E2",
};

export const brl = (n) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const num = (n) => Number(n || 0).toLocaleString("pt-BR");

export const PIX_KEY = "12.345.678/0001-90"; // CNPJ do posto — troque pela chave real
export const PIX_PAYLOAD =
  "00020126360014BR.GOV.BCB.PIX0114123456780001905204000053039865802BR5913POSTO DONAROSA6009GUADALUPE62070503***6304A1B2";

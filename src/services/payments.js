/**
 * Tokenização de cartão (RN-38). Em produção, substitua tokenizeCard pelo SDK do gateway escolhido
 * (Mercado Pago, Pagar.me, Stripe…): ele recebe os dados do cartão direto no navegador e devolve
 * um token. Número e CVV nunca vão para o backend da plataforma.
 *
 * A implementação abaixo é a do ambiente de testes ("sandbox"), aceita pelo backend:
 * cartões terminados em 0002 simulam recusa do emissor.
 */
export function cardBrand(digits) {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(digits)) return "Elo";
  return "Cartão";
}

/** Algoritmo de Luhn: pega erros de digitação antes de chamar o gateway */
export function luhnOk(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

export async function tokenizeCard({ number }) {
  const digits = number.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return { token: last4 === "0002" ? `tok_test_decline_${last4}` : `tok_test_${last4}`, last4, brand: cardBrand(digits) };
}

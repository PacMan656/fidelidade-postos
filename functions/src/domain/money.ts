/** Dinheiro sempre em centavos inteiros (RN-33). A configuração da rede usa reais para facilitar a edição. */
export const toCents = (reais: number): number => Math.round(Number(reais) * 100);
export const fromCents = (cents: number): number => cents / 100;

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

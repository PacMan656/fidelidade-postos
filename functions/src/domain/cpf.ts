/** Validação de CPF pelos dígitos verificadores (RN-11). */
export function normalizeCpf(input: string): string {
  return String(input ?? "").replace(/\D/g, "");
}

export function isValidCpf(input: string): boolean {
  const cpf = normalizeCpf(input);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

/** Máscara exibida ao cliente e ao frentista (RN-12, RN-65). */
export function maskCpf(input: string): string {
  const cpf = normalizeCpf(input);
  return `•••.•••.${cpf.slice(6, 9)}-${cpf.slice(9, 11)}`;
}

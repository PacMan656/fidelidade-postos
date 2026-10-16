import { randomInt } from "node:crypto";

// sem 0/O, 1/I/L para leitura em voz alta no caixa (RN-30)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function shortCode(len = 8): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const isShortCode = (s: string, len = 8) => new RegExp(`^[${ALPHABET}]{${len}}$`).test(s);

/**
 * BR Code (Pix copia e cola) no padrão EMV do Banco Central, com valor e txid.
 * Usado pelo provedor "chave estática": o cliente paga na chave da rede e a confirmação vem
 * do webhook do banco/PSP ou da confirmação manual do gerente.
 */
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

const ascii = (s: string, max: number) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .\-]/g, "").toUpperCase().trim().slice(0, max);

/** CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF), exigido no campo 63 */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface BrCodeInput { key: string; merchantName: string; merchantCity: string; amountCents: number; txid: string; description?: string }

export function buildBrCode(i: BrCodeInput): string {
  const txid = i.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const account = field("00", "br.gov.bcb.pix") + field("01", i.key.trim()) + (i.description ? field("02", ascii(i.description, 40)) : "");
  const payload =
    field("00", "01") +
    field("26", account) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (i.amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", ascii(i.merchantName, 25) || "RECEBEDOR") +
    field("60", ascii(i.merchantCity, 15) || "BRASIL") +
    field("62", field("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

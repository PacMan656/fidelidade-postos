// Cria functions/.secret.local com segredos de teste para os emuladores (não usar em produção).
import { existsSync, writeFileSync } from "node:fs";
const file = new URL("../functions/.secret.local", import.meta.url);
if (!existsSync(file)) {
  writeFileSync(file, "QR_SIGNING_KEY=segredo-qr-teste\nCPF_PEPPER=segredo-cpf-teste\nPIX_WEBHOOK_SECRET=segredo-webhook-teste\n");
  console.log("functions/.secret.local criado com segredos de teste");
}

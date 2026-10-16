# Implantação no Firebase

Passo a passo para colocar a plataforma no ar em um projeto Firebase seu.

## 1. Projeto

1. Crie o projeto em https://console.firebase.google.com (um projeto atende todas as redes).
2. Ative o plano **Blaze**: Cloud Functions e Secret Manager exigem faturamento.
3. **Authentication** → Método de login → ative **E-mail/senha**. Em Configurações → Domínios
   autorizados, adicione os domínios das redes.
4. **Firestore** → Criar banco → modo produção → local `southamerica-east1` (São Paulo).
5. **Configurações do projeto** → Seus apps → adicione um **App da Web** e copie a configuração.

## 2. Ambiente local

```bash
npm install -g firebase-tools   # ou use npx firebase
firebase login
firebase use --add              # escolha o projeto e dê o alias "default"
cp .env.example .env.production # preencha com a configuração do app da web
```

## 3. Segredos e parâmetros das functions

```bash
firebase functions:secrets:set QR_SIGNING_KEY       # texto aleatório longo (ex.: openssl rand -hex 32)
firebase functions:secrets:set CPF_PEPPER           # outro texto aleatório; NÃO troque depois (invalida o índice de CPF)
firebase functions:secrets:set PIX_WEBHOOK_SECRET   # segredo combinado com o banco/PSP
```

Crie `functions/.env.<id-do-projeto>` com:

```
ENFORCE_APP_CHECK=true
```

e configure o **App Check** (reCAPTCHA Enterprise) no console, colocando a chave do site em
`VITE_RECAPTCHA_SITE_KEY`.

## 4. Primeiro deploy

```bash
npm test                 # garante que está tudo verde
npm run deploy           # build + hosting + functions + regras + índices
```

Os índices compostos levam alguns minutos para ficar prontos depois do primeiro deploy.

## 5. Carga inicial

Gere uma chave de conta de serviço (Configurações → Contas de serviço → Gerar nova chave privada),
guarde fora do repositório e rode:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave.json npm --prefix functions run seed -- \
  --project <id-do-projeto> --admin-email voce@empresa.com --admin-password 'uma-senha-forte'
```

Isso cria as redes de `seed/tenants/` e o administrador da plataforma. Depois, pelo painel
(`https://<seu-dominio>/#/admin`):

1. Crie as redes clientes em **Nova rede** (copiando uma existente).
2. Em **Equipe**, defina o dono de cada rede (a pessoa precisa ter criado a conta no app).
3. O dono cadastra gerentes; gerentes cadastram frentistas.

## 6. Domínios das redes

1. Firebase Hosting → Adicionar domínio personalizado (ex.: `app.donarosa.com.br`) e siga a
   verificação de DNS.
2. No painel da rede → **Domínios**, cadastre o mesmo domínio. O app passa a abrir já com a rede.

## 7. Pix

- **Chave estática (padrão)**: preencha chave, nome e cidade do recebedor no painel → Pix. A
  confirmação vem do webhook do banco ou da confirmação manual do gerente.
- **Webhook**: cadastre no banco/PSP a URL `https://<seu-dominio>/pixWebhook/<id-da-rede>`. O corpo
  segue a API Pix do Banco Central (`{"pix":[{"txid","valor","endToEndId","horario"}]}`) e precisa do
  cabeçalho `x-webhook-signature` = HMAC-SHA256 (hex) do corpo com `PIX_WEBHOOK_SECRET`. Bancos que
  autenticam o webhook por mTLS precisam de um intermediário que valide o certificado e assine a chamada.

## 8. Cartão de crédito

O repositório vem com o gateway de testes. Antes de aceitar cartões reais:

1. Contrate um gateway com tokenização (Mercado Pago, Pagar.me, Stripe, Cielo…).
2. Troque `tokenizeCard` em `src/services/payments.js` pelo SDK do gateway (os dados do cartão vão
   direto do navegador para o gateway).
3. Implemente `CardGateway` em `functions/src/providers/payments.ts` e guarde a chave do gateway
   como segredo (`firebase functions:secrets:set GATEWAY_KEY`).

## 9. Deploy automático (GitHub Actions)

O workflow `.github/workflows/deploy.yml` publica ao criar uma tag `v*` ou manualmente. Configure
no repositório (Settings → Secrets and variables → Actions):

| Tipo | Nome | Valor |
|---|---|---|
| Variable | `FIREBASE_PROJECT_ID` | id do projeto |
| Variable | `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_DEFAULT_TENANT` | do app da web |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON da conta de serviço com papéis de deploy (Firebase Admin, Cloud Functions Admin, Service Account User, Secret Manager Viewer) |
| Secret | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`, `VITE_RECAPTCHA_SITE_KEY` | do app da web |

O workflow `ci.yml` roda todos os testes (inclusive nos emuladores) em cada push e pull request.

## Checklist antes de abrir para clientes

- [ ] Segredos definidos e `ENFORCE_APP_CHECK=true`
- [ ] Gateway de cartão real implementado (ou carteira só com Pix)
- [ ] Webhook Pix configurado e testado com um Pix de R$ 0,01… R$ 10
- [ ] Domínios verificados e cadastrados nas redes
- [ ] Termos de uso e política de privacidade publicados (RN-66)
- [ ] Alertas de erro das functions no Cloud Monitoring
- [ ] Backup agendado do Firestore (exportação diária para o Cloud Storage)

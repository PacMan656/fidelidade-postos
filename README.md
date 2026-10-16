# Fidelidade Postos

Plataforma white-label de fidelidade para redes de postos de combustível. Um único build atende
várias redes: cada uma tem marca, preços, prêmios, parceiros e regras próprias, alteradas pelo
Painel da rede sem nova versão do app.

| Parte | O que é |
|---|---|
| **App do cliente** | Pontos, níveis, oferta do dia, QR de identificação, carteira (Pix e cartão), pagamento pelo app, trava de preço, resgates e vouchers, clube de parceiros, manutenção |
| **App da equipe** | Identificar cliente (QR ou CPF), registrar venda com oferta e trava, validar voucher, campanha de incentivo e ranking |
| **Painel da rede** | Marca, textos, recursos, ofertas, preços, prêmios, parceiros, missões, Pix, campanha, equipe, domínios, histórico de versões |
| **Backend** | Firebase: Auth, Firestore, Cloud Functions (Node 22), Hosting |

Documentação:
- [Regras de negócio](docs/REGRAS_DE_NEGOCIO.md) — 68 regras numeradas (RN-xx), citadas no código e nos testes
- [Arquitetura](docs/ARQUITETURA.md) — modelo de dados, functions, segurança
- [Implantação](docs/IMPLANTACAO.md) — passo a passo para colocar no ar no seu projeto Firebase

## Começar

Requisitos: Node 22 e Java 17+ (para os emuladores do Firebase).

```bash
npm install
npm --prefix functions install
```

**Modo demonstração** (sem Firebase, dados no navegador):

```bash
npm run dev
```

**Com o Firebase local** (emuladores com dados de exemplo):

```bash
npm run dev:emulators
```

Abre o app em http://localhost:5173 e o console dos emuladores em http://localhost:4000.
Contas criadas (senha `demo12345`): `cliente@demo.com`, `carlos@demo.com` (frentista),
`gerente@demo.com`, `dono@demo.com`, `admin@demo.com` (plataforma). O cliente faz o cadastro na
rede pelo próprio app (CPF e celular). Painel: http://localhost:5173/#/admin

Outra rede no mesmo build: `?rede=rede-avenida` no endereço.

## Testes

```bash
npm test                         # tudo
npm --prefix functions run test:unit   # regras de cálculo (sem emulador)
npm run test:emulators           # regras de segurança + fluxos completos nos emuladores
```

## Estrutura

```
src/                     app do cliente, da equipe e painel (React + Vite)
  config/                configuração da rede (tempo real) e API do painel
  store/                 estado: FirebaseStore (produção) e DemoStore (demonstração)
  services/              Firebase e tokenização de cartão
  admin/                 painel da rede
functions/               Cloud Functions (TypeScript)
  src/domain/            regras de negócio puras (pontos, venda, Pix, CPF…)
  src/callable/          funções chamadas pelo app (cliente, equipe, gestão)
  src/http/              webhook de confirmação Pix
  src/scheduled/         vencimentos diários
  test/                  unitários, regras de segurança e integração
  scripts/seed.mjs       carga inicial (redes, administrador, dados de exemplo)
seed/tenants/            configuração inicial de cada rede
firestore.rules          regras de segurança
firestore.indexes.json   índices
.github/workflows/       CI (testes) e deploy
```

## Scripts

| Comando | Faz |
|---|---|
| `npm run dev` | app em modo demonstração |
| `npm run dev:emulators` | app + emuladores do Firebase com dados de exemplo |
| `npm test` | todos os testes |
| `npm run build` | build de produção em `dist/` |
| `npm run deploy` | build + deploy (hosting, functions, regras e índices) |
| `npm --prefix functions run seed` | carga inicial no projeto (ver docs/IMPLANTACAO.md) |

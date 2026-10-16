# Arquitetura

```
 App do cliente / equipe ─┐             ┌─ Firestore (dados)  ◀── leitura em tempo real, filtrada pelas regras
 Painel da rede ──────────┼─ Firebase ──┼─ Cloud Functions    ◀── toda escrita de saldo, pontos, vendas, vouchers
                          │   Auth      └─ Hosting (app + painel, um build para todas as redes)
 Banco / PSP Pix ─────────┴──────────────▶ pixWebhook (HTTP, assinado)
```

Princípio central (RN-64): **o app só lê**. Toda alteração de valor passa por uma Cloud Function,
em transação do Firestore, com validação das regras de negócio. As regras de segurança impedem
qualquer escrita direta, exceto marcar notificação como lida.

## Multi-rede (white-label)

- `tenants/{rede}` guarda a configuração pública da rede (marca, textos, recursos, preços, prêmios,
  parceiros, missões, campanha, regras numéricas). O app assina esse documento e se redesenha quando
  a versão muda.
- A rede é descoberta por `?rede=`, pela última rede usada no aparelho ou pelo domínio
  (`domains/{host}` → `tenantId`).
- Papéis da equipe ficam em *custom claims* do Firebase Auth: `roles: { "<rede>": "attendant" | "manager" | "owner" }`
  e `platformAdmin: true` para o operador da plataforma.

## Modelo de dados (Firestore)

```
domains/{host}                              { tenantId }
tenants/{t}                                 configuração pública + version, status, updatedAt
  configHistory/{versão}                    versões anteriores
  audit/{id}                                ações administrativas (RN-04)
  customers/{uid}                           nome, cpfMasked, cpfHash, points, lifetimePoints, level, prepaidCents, lockedLiters, car
    ledger/{id}                             extrato de pontos; ganhos são lotes com remaining/expiresAt/open (RN-21, RN-22)
    wallet/{id}                             movimentos da carteira em centavos
    cards/{id}                              bandeira, últimos dígitos, padrão
    fuelLocks/{id}                          trava de preço: litros, preço, validade
    offers/{AAAA-MM-DD}                     ativação da oferta do dia
    maintenance/{id}                        itens de manutenção e agendamento
    coupons/{parceiro}                      cupons do clube
    notifications/{id}                      notificações
    rewardUsage/{prêmio_AAAA-MM}            contagem para limite mensal
  vouchers/{código}                         voucher de resgate (uso único)
  sales/{id}                                vendas (POS e app), idempotentes por requestId
  campaigns/{campanha}/staff/{uid}          contadores, vendas, identificadas, bônus
  staff/{uid}                               equipe: papel, posto, código de indicação
  pixCharges/{txid}                         cobranças Pix
  appointments/{id}, slots/{posto_dia_hora} agendamentos e capacidade
  -- sem acesso pelo app --
  cpfIndex/{hash}, cardTokens/{id}, staffCodes/{código}, rewardStock/{prêmio}, operations/{id}, pixEvents/{e2e}
```

## Cloud Functions

Região `southamerica-east1`. Todas as *callables* exigem usuário autenticado; com
`ENFORCE_APP_CHECK=true` exigem também App Check.

| Função | Quem | Regras |
|---|---|---|
| `joinTenant` | cliente | RN-11 a RN-14 |
| `updateProfile` | cliente | RN-15 |
| `issueCheckinToken` | cliente | RN-49 |
| `activateOffer` | cliente | RN-45, RN-46 |
| `redeemReward` | cliente | RN-22, RN-28 a RN-30 |
| `createPixCharge` | cliente | RN-34 a RN-36 |
| `addCard`, `removeCard`, `setDefaultCard`, `creditWithCard` | cliente | RN-34, RN-38 |
| `payWithApp` | cliente | RN-17, RN-20, RN-37 |
| `lockFuelPrice` | cliente | RN-40 a RN-44 |
| `scheduleMaintenance` | cliente | RN-59 |
| `claimCoupon` | cliente | RN-61 |
| `lookupCustomer` | equipe | RN-49, RN-65 |
| `registerSale` | equipe | RN-16 a RN-20, RN-46 a RN-56 |
| `validateVoucher` | equipe | RN-31 |
| `publishConfig`, `rollbackConfig`, `listConfigHistory` | gerente | RN-06 a RN-08, RN-10 |
| `setStaffRole` | gerente/dono | RN-02, RN-03 |
| `adjustPoints`, `cancelVoucher`, `confirmPixCharge` | gerente | RN-27, RN-32, RN-35 |
| `myTenants` | equipe | — |
| `createTenant`, `setTenantStatus` | plataforma | RN-05, RN-09 |
| `pixWebhook` (HTTP) | banco/PSP | RN-35 |
| `dailyExpirations` (03:10) | agendada | RN-23, RN-30, RN-42 |
| `pixChargeExpiration` (15 min) | agendada | RN-36 |

Segredos (Secret Manager): `QR_SIGNING_KEY`, `CPF_PEPPER`, `PIX_WEBHOOK_SECRET`.

## Pagamentos

`functions/src/providers/payments.ts` define as interfaces:

- **Pix**: o provedor padrão gera o BR Code (copia e cola) com valor e txid na chave da rede. A
  confirmação chega pelo `pixWebhook` (formato da API Pix do Banco Central, autenticado por HMAC)
  ou pela confirmação manual do gerente (`confirmPixCharge`). Para Pix dinâmico com cobrança
  registrada (cob), implemente `PixProvider` com a API do seu banco/PSP.
- **Cartão**: o app tokeniza no gateway (`src/services/payments.js`) e o backend cobra pelo token
  (`CardGateway`). O repositório traz o gateway *sandbox* (tokens `tok_test_*`). Antes de aceitar
  cartões reais, implemente `CardGateway` e `tokenizeCard` com o gateway contratado.

## Testes

- `functions/test/unit` — regras puras: pontos, FIFO, venda, CPF, BR Code, fuso horário, QR.
- `functions/test/rules` — regras de segurança do Firestore por perfil.
- `functions/test/integration` — functions reais nos emuladores: cadastro, venda, Pix com webhook,
  carteira, cartão, resgate, voucher, publicação, permissões, suspensão, vencimentos.

# Postos Dona Rosa — App de fidelidade

App web mobile-first (instalável como PWA) feito a partir do protótipo Dona Rosa, com telas próprias e navegação por rotas.

## Rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera dist/ (pronto para hospedar em qualquer servidor estático)
```

Para entrar, use "Preencher dados de demonstração" na tela de login (cliente ou frentista).
O estado fica salvo no navegador (localStorage); "Restaurar dados de demonstração" no perfil zera tudo.

## Telas

**Acesso:** Boas-vindas (3 passos) · Entrar (cliente / frentista)

**Cliente — abas:** Início · Carteira · (QR central) · Resgatar · Clube

| Tela | Rota |
|---|---|
| Meu QR Code | `/qr` |
| Extrato de pontos (com filtros) | `/extrato` |
| Adicionar crédito (Pix / cartão) | `/carteira/adicionar-credito` |
| Adicionar cartão (com pré-visualização) | `/carteira/adicionar-cartao` |
| Gerenciar cartões | `/carteira/cartoes` |
| Pagar no posto | `/carteira/pagar` |
| Comprovante | `/carteira/comprovante` |
| Detalhe do prêmio + confirmação | `/resgatar/:id` |
| Meus vouchers / voucher | `/vouchers`, `/vouchers/:code` |
| Detalhe do parceiro + cupom | `/clube/:id` |
| Trava de preço | `/trava-de-preco` |
| Manutenção / agendar serviço | `/manutencao`, `/manutencao/agendar/:id` |
| Notificações | `/notificacoes` |
| Perfil / meu veículo | `/perfil`, `/perfil/veiculo` |

**Frentista — abas:** Painel · Metas · Ranking · Perfil

## Estrutura

```
src/
  theme.js              cores e formatadores (R$, números)
  store/data.js         catálogo, parceiros, dados iniciais
  store/AppStore.jsx    estado global + ações (resgatar, pagar, travar preço…)
  components/           UI compartilhada e layouts com navegação inferior
  screens/auth|cliente|frentista
```

## Antes de produção

Tudo aqui é demonstração: login, Pix, cartões e pagamentos são simulados no navegador.
Para produção é preciso um backend (autenticação, saldo, pontos), integração Pix com confirmação
automática (PSP/banco), gateway de cartão certificado PCI-DSS (tokenização — nunca guardar número/CVV)
e integração com o PDV do posto para os números do modo frentista.

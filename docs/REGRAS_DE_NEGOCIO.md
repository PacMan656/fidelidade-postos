# Regras de negócio

Plataforma white-label de fidelidade para redes de postos. Este documento é a referência para o
backend (Cloud Functions + regras do Firestore), o app e o painel. Cada regra tem um código
(`RN-xx`), citado nos comentários e nos testes do código.

Valores marcados como **configurável** são definidos por rede no Painel da rede; o número entre
parênteses é o padrão.

---

## 1. Atores e papéis

| Papel | Quem é | O que pode |
|---|---|---|
| **Cliente** | Consumidor final | Ver e usar os próprios pontos, carteira, vouchers, trava de preço, agendamentos |
| **Frentista** (`attendant`) | Funcionário do posto | Identificar cliente, registrar venda, validar voucher, ver a própria campanha |
| **Gerente** (`manager`) | Gestor da rede | Tudo do frentista + editar e publicar a configuração da rede, ver relatórios, ajustar pontos, gerenciar equipe |
| **Dono** (`owner`) | Responsável legal da rede | Tudo do gerente + promover gerentes |
| **Administrador da plataforma** | Operador do sistema | Criar e suspender redes, atuar em qualquer rede |

- **RN-01** Uma pessoa tem uma única conta (e-mail) na plataforma e pode ser cliente de várias redes. Pontos, saldo e vouchers **nunca** passam de uma rede para outra.
- **RN-02** Papéis de equipe valem por rede. A mesma pessoa pode ser gerente de uma rede e cliente de outra.
- **RN-03** Só o dono ou o administrador da plataforma promove alguém a gerente. Gerentes cadastram frentistas.
- **RN-04** Toda ação administrativa (publicar configuração, ajustar pontos, alterar equipe, criar rede) gera registro de auditoria com autor, data e motivo, que não pode ser apagado.

## 2. Rede (tenant) e configuração

- **RN-05** Cada rede tem um identificador único (minúsculas, números e hífen, 2–41 caracteres) e uma configuração pública: marca, textos, recursos, preços, prêmios, parceiros, missões, campanha e regras numéricas.
- **RN-06** Publicar a configuração incrementa a versão, guarda a anterior no histórico e é refletido nos apps em tempo real. Uma configuração inválida é recusada e nada muda.
- **RN-07** Se a versão publicada mudou enquanto o gerente editava, a publicação é recusada (conflito) até ele recarregar.
- **RN-08** Restaurar uma versão antiga publica uma nova versão com aquele conteúdo; o histórico nunca é reescrito.
- **RN-09** Uma rede **suspensa** não aceita novas vendas, resgates, recargas nem cadastros. Clientes ainda consultam saldo e extrato.
- **RN-10** Um domínio aponta para no máximo uma rede.

## 3. Cadastro do cliente

- **RN-11** Para participar de uma rede o cliente informa nome, CPF válido (dígitos verificadores) e celular. E-mail e senha vêm da conta.
- **RN-12** O CPF é único **por rede**. O sistema guarda apenas o CPF mascarado (`•••.•••.443-08`) e um hash com segredo do servidor, para checar duplicidade sem expor o documento.
- **RN-13** Ao entrar na rede o cliente recebe o **bônus de boas-vindas** (configurável, 200 pontos), uma única vez por CPF por rede.
- **RN-14** Se o cadastro foi feito com o código de um frentista, a meta "clientes cadastrados" desse frentista sobe 1 na campanha ativa.
- **RN-15** O cliente pode alterar nome, celular e dados do veículo. CPF não pode ser alterado pelo app (só pelo atendimento, com auditoria).

## 4. Pontos

### Acúmulo
- **RN-16** Pontos são inteiros. Em cada venda identificada: `pontos = piso(valor pago em R$ × pontos por real)` (configurável, 1).
- **RN-17** Pagando pelo app (carteira ou cartão cadastrado), multiplica-se pelo **multiplicador do app** (configurável, 2).
- **RN-18** Pontos são calculados sobre o valor **efetivamente pago**, depois de descontos de oferta e de litros da trava de preço.
- **RN-19** Litros abastecidos com a trava de preço não geram pontos de novo (os pontos já são dados na compra da trava, pelo valor pago).
- **RN-20** Uma venda só gera pontos uma vez. O registro de venda é idempotente: a mesma chave de idempotência não cria uma segunda venda.

### Validade
- **RN-21** Cada lote de pontos ganho expira após N meses (configurável, 12), contados da data do ganho.
- **RN-22** Resgates consomem primeiro os pontos que vencem antes (FIFO por vencimento).
- **RN-23** Pontos vencidos são baixados diariamente e aparecem no extrato como "Pontos expirados".
- **RN-24** O app avisa quando houver pontos vencendo nos próximos 30 dias.

### Níveis
- **RN-25** O nível é definido pelos **pontos acumulados na vida** (soma de tudo que foi ganho, sem descontar resgates nem expirações). Resgatar nunca rebaixa o nível.
- **RN-26** Os níveis e seus mínimos são configuráveis. O nível é recalculado a cada ganho.

### Ajustes
- **RN-27** Gerentes podem creditar ou debitar pontos manualmente, sempre com motivo obrigatório e auditoria. O saldo nunca fica negativo.

## 5. Resgate de prêmios

- **RN-28** Só prêmios ativos podem ser resgatados, e só se o saldo cobrir o custo.
- **RN-29** Prêmios podem ter **estoque** (opcional) e **limite por cliente por mês** (opcional). Sem estoque, o resgate é recusado.
- **RN-30** O resgate debita os pontos e o estoque na mesma transação e gera um **voucher** com código único (8 caracteres, sem letras ambíguas), válido por N dias (configurável, 30).
- **RN-31** O voucher é de **uso único**. O frentista valida o código; a validação registra quem validou, em qual posto e quando.
- **RN-32** Voucher vencido não pode ser usado e os pontos **não** voltam. Voucher cancelado pelo gerente (ex.: prêmio indisponível) devolve os pontos como novo lote com validade cheia.

## 6. Carteira pré-paga

- **RN-33** Valores monetários são guardados em centavos (inteiros).
- **RN-34** Recarga mínima R$ 10, máxima R$ 1.000 por operação e saldo máximo R$ 2.000 (configuráveis).
- **RN-35** Recarga por Pix: o sistema gera uma cobrança com prazo (configurável, 30 min). O saldo só é creditado quando o provedor Pix confirma o pagamento via webhook assinado. A mesma confirmação nunca credita duas vezes.
- **RN-36** Cobrança Pix vencida é cancelada automaticamente.
- **RN-37** Pagamento com saldo: o valor não pode exceder o saldo; débito, venda e pontos acontecem juntos ou nada acontece.
- **RN-38** Dados de cartão nunca passam pelo servidor da plataforma. O app tokeniza no provedor de pagamento e o backend guarda só token, bandeira e 4 últimos dígitos.
- **RN-39** O saldo da carteira não é sacável e não expira enquanto a conta existir. Estorno de recarga só pelo atendimento, com auditoria.

## 7. Trava de preço (banco de litros)

- **RN-40** O cliente compra litros de um combustível ao preço vigente na configuração, pagando com saldo da carteira.
- **RN-41** Quantidade por compra entre 5 e 200 litros, e no máximo 300 litros travados ativos por cliente (configuráveis).
- **RN-42** A trava vale N dias (configurável, 30). Litros não usados no prazo expiram; o valor pago é devolvido à carteira proporcionalmente aos litros restantes.
- **RN-43** No abastecimento, o frentista pode consumir litros travados do combustível abastecido; consome primeiro a trava que vence antes.
- **RN-44** A compra da trava gera pontos pelo valor pago, com multiplicador do app (RN-17).

## 8. Oferta do dia

- **RN-45** Quando a rede publica uma oferta ativa, o cliente precisa **ativá-la** no app; a ativação vale até o horário de término (configurável, 23h, horário de Brasília) do mesmo dia.
- **RN-46** Uma ativação por cliente por dia. O desconto é por litro (configurável, R$ 0,20) até o limite diário de litros (configurável, 100 L).
- **RN-47** O desconto é aplicado automaticamente na venda registrada para o cliente identificado com oferta ativa.

## 9. Venda no posto

- **RN-48** O frentista registra a venda informando posto, combustível, litros, valor bruto, forma de pagamento, itens adicionais (troca de óleo, aditivo, lavagem…) e, se houver, o cliente.
- **RN-49** O cliente é identificado por um **QR temporário** gerado no app (válido 5 minutos, assinado pelo servidor) ou pelo CPF. O QR nunca contém o CPF.
- **RN-50** Ordem de cálculo: valor bruto → desconto da oferta (RN-46) → litros da trava (RN-43) → valor a pagar → pontos (RN-16 a RN-19).
- **RN-51** Venda com cliente conta como "venda identificada" para a meta de identificação da campanha.
- **RN-52** Frentista só registra vendas e valida vouchers da rede em que tem papel ativo.

## 10. Campanha de incentivo da equipe

- **RN-53** A rede define a campanha ativa: período, metas por item (ex.: trocas de óleo), bônus em R$ por unidade, meta de identificação (%) e prêmio.
- **RN-54** Os contadores sobem automaticamente a partir das vendas registradas (itens adicionais) e dos cadastros com código do frentista (RN-14). Não há botão manual em produção.
- **RN-55** Bônus do frentista = soma de (quantidade × bônus por unidade) de cada meta.
- **RN-56** Identificação = vendas identificadas ÷ vendas totais do frentista no período.
- **RN-57** O ranking mostra os frentistas da rede ordenados por bônus. Frentistas veem o ranking da própria rede.

## 11. Manutenção

- **RN-58** A previsão usa a quilometragem informada e a média mensal estimada pelos abastecimentos.
- **RN-59** O agendamento escolhe posto, dia (segunda a sábado, a partir de amanhã) e horário disponível. Um horário comporta no máximo N agendamentos por posto (configurável, 2).
- **RN-60** Serviço agendado pelo app e concluído no posto rende o multiplicador do app sobre o valor pago.

## 12. Clube de parceiros

- **RN-61** O cliente guarda o cupom de um parceiro ativo; o cupom tem código único e regras definidas pela rede. Um cupom por parceiro por cliente enquanto a oferta estiver ativa.

## 13. Notificações

- **RN-62** O sistema notifica: oferta do dia publicada, pontos a vencer, voucher gerado, recarga confirmada, agendamento confirmado.
- **RN-63** O cliente pode marcar notificações como lidas. Ele não cria nem apaga notificações.

## 14. Segurança e privacidade (LGPD)

- **RN-64** Saldos, pontos, vouchers e vendas só são alterados pelo backend. O app nunca escreve esses dados diretamente (garantido pelas regras do Firestore).
- **RN-65** Cada cliente só lê os próprios dados. Frentistas não leem dados pessoais completos; recebem nome e CPF mascarado ao identificar o cliente.
- **RN-66** Dados pessoais mínimos: nome, CPF (hash + máscara), celular, e-mail. O cliente pode pedir exclusão da conta; o histórico financeiro é mantido anonimizado pelo prazo legal.
- **RN-67** Segredos (chave de assinatura do QR, segredo do webhook Pix, sal do hash de CPF, credenciais de provedores) ficam no Secret Manager, nunca no código nem no Firestore.
- **RN-68** Chamadas do app ao backend exigem usuário autenticado; em produção, também o App Check.

---

## Fórmulas de referência

```
desconto_oferta   = min(litros, limite_diário_restante) × desconto_por_litro
litros_trava      = min(litros, litros_travados_disponíveis_do_combustível)
valor_trava       = litros_trava × preço_vigente
valor_pago        = max(0, valor_bruto − desconto_oferta − valor_trava)
pontos            = piso(valor_pago_em_reais × pontos_por_real × (pago_pelo_app ? multiplicador : 1))
bônus_frentista   = Σ (quantidade_item × bônus_item)
identificação     = vendas_com_cliente ÷ vendas_totais
```

## Exemplo

Cliente nível Ouro, oferta ativada (R$ 0,20/L), 10 L de gasolina travados a R$ 6,17. Abastece 40 L
de gasolina a R$ 6,29 (bruto R$ 251,60) e paga com a carteira (multiplicador 2):

| Passo | Valor |
|---|---|
| Desconto da oferta: 40 × 0,20 | − R$ 8,00 |
| Litros da trava: 10 × 6,29 | − R$ 62,90 |
| Valor pago | **R$ 180,70** |
| Pontos: piso(180,70 × 1 × 2) | **361 pontos** |

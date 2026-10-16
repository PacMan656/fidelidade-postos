# App de fidelidade para redes de postos (white-label)

Um único build do app atende várias redes. Tudo o que muda de uma rede para outra fica numa
**configuração remota**, editada no **Painel da rede**. A publicação chega aos apps sem novo build
e sem atualização na loja.

```
 Painel da rede (/#/admin) ──PUT──▶ Servidor de configuração ◀──GET a cada 1 min── App (cliente/frentista)
                                    server/data/tenants/<rede>.json
```

## Rodar

```bash
npm install
npm run start        # compila o app e sobe o servidor em http://localhost:8787
# desenvolvimento: em um terminal `npm run server`, em outro `npm run dev`
```

- App da Dona Rosa: `http://localhost:8787/?rede=dona-rosa`
- App da Rede Avenida (mesmo build): `http://localhost:8787/?rede=rede-avenida`
- Painel: `http://localhost:8787/#/admin`

Tokens de exemplo (em `server/data/admins.json`, **troque antes de publicar**):

| Token | Acesso |
|---|---|
| `admin-plataforma-troque` | todas as redes + criar redes |
| `dona-rosa-troque` | só Dona Rosa |
| `avenida-troque` | só Rede Avenida |

Em produção, defina `ADMIN_TOKEN` (acesso total) ou edite `admins.json`.

## O que cada rede altera pelo painel

| Seção | Exemplos |
|---|---|
| Marca e cores | nome, sigla do selo, paleta (as cores derivadas são calculadas) |
| Textos | boas-vindas, subtítulos, nome da carteira |
| Recursos do app | liga/desliga carteira, Pix, trava de preço, manutenção, clube, missões, modo frentista |
| Oferta do dia | valor, descrição, validade, aviso no QR |
| Preços e trava | combustíveis e preço por litro, validade e atalhos da trava |
| Pontos e níveis | pontos por real, multiplicador no app, níveis |
| Prêmios, parceiros, missões | cadastro completo, ativar/desativar, ordem |
| Pix | chave, legenda, código copia e cola |
| Campanha frentistas | metas, bônus por unidade, prêmio, desafios |
| Postos e atendimento | unidades (usadas no agendamento), telefone, e-mail |
| Domínios | domínios que abrem o app já com a rede |
| Histórico | cada publicação guarda a anterior; restaurar em um clique |

O painel tem pré-visualização ao vivo do rascunho, validação antes de publicar e proteção contra
duas pessoas publicando ao mesmo tempo (conflito de versão).

## Como o app descobre a rede

1. `?rede=<id>` no endereço (fica salvo no aparelho)
2. a última rede usada no aparelho
3. o domínio (`domains` na configuração), via `GET /api/resolve`
4. a rede padrão (`VITE_DEFAULT_TENANT`, padrão `dona-rosa`)

O app guarda a última configuração recebida e abre com ela mesmo sem internet. Busca de novo a cada
minuto e sempre que volta ao primeiro plano. O estado do usuário é separado por rede.

## API do servidor

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/config/:rede` | configuração pública (app) |
| GET | `/api/resolve?host=` | rede pelo domínio |
| GET | `/api/tenants` | redes que o token edita |
| PUT | `/api/config/:rede` | publica (valida e incrementa a versão) |
| POST | `/api/tenants` | cria rede copiando outra (só administrador da plataforma) |
| GET | `/api/config/:rede/history` | versões anteriores |
| POST | `/api/config/:rede/rollback/:versao` | restaura uma versão |

Sem servidor (por exemplo, numa hospedagem estática), app e painel entram em **modo demonstração**:
as configurações embutidas servem de base e as edições ficam só no navegador.

## Estrutura

```
server/index.js                 servidor de configuração (Node puro, sem dependências)
server/data/tenants/*.json      uma configuração por rede
server/data/admins.json         tokens do painel
src/config/                     provedor de configuração, API, catálogo de ícones
src/admin/                      painel da rede (carregado só em /#/admin)
src/store/                      estado do usuário (por rede)
src/screens/                    telas do app
```

## Limites e próximos passos

- **Mudanças de código** (uma tela nova, uma regra nova) ainda pedem build. Como o app é web/PWA,
  basta publicar o build no servidor e todos recebem; não há loja. Se o app virar nativo
  (React Native/Expo), use atualização OTA (EAS Update) para código e mantenha esta configuração para conteúdo.
- **Para produção:** trocar os arquivos JSON por banco de dados, login individual no painel (em vez de
  tokens), HTTPS, backup do histórico e, no app, backend real para conta, saldo, pontos, Pix com
  confirmação automática e gateway de cartão PCI-DSS.

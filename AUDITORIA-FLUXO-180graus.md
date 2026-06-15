# Auditoria de fluxo, lógica e produto — Recrutamento 180 Graus

**Data:** 15/06/2026 · **Tipo:** somente leitura (Chrome + leitura de código). Nada foi alterado.
**Login testado:** acesso total (Denis). Não havia usuário de "visualização" disponível para teste ao vivo.

---

## 1. Resumo executivo

**O sistema está coerente?** Em grande parte, sim — e melhorou bastante. O conceito mais sensível ("Em treinamento já é operação, não seleção") está **implementado corretamente**: a pessoa em treinamento sai de Candidatos, aparece em Equipe › Em treinamento, não conta como ativo nem efetivado, mostra quem indicou, e na busca aparece como "Equipe — Em treinamento". A efetivação **não duplica** pessoa na equipe e o bônus só nasce na efetivação.

**Pode ir para produção agora?** Ainda não — falta validar permissões com um usuário real de visualização e resolver um ponto de congruência importante (pessoa efetivada continua aparecendo como "Candidato › Efetivado" **e** na Equipe). Mais os itens de segurança da Fase A ainda pendentes (advisors, rate limit, token em texto).

**Maiores bloqueios:**
1. **Efetivado em dois lugares** — Candidatos › Efetivados e Equipe ao mesmo tempo (duas fontes de verdade para a mesma pessoa).
2. **Permissões não validadas ao vivo** — sem usuário de visualização para confirmar CPF mascarado, bloqueio de currículo e ausência de botões.
3. **Pendências de segurança da Fase A** ainda não aplicadas (REVOKE das funções, senha vazada, rate limit; + token da ficha agora legível em texto).

---

## 2. Cenários testados

| Cenário | Resultado | Problemas |
|---|---|---|
| A — Ficha pública | Não reexecutado ponta a ponta nesta rodada (validado em auditorias anteriores; lógica condicional de moradia/renda/currículo intacta no código) | — |
| B — Ficha no RH | OK (listas, filtros, status, ações por contexto) | Ficha fica "Selecionada" para sempre (histórico) |
| C — Candidato em processo | OK — só online/presencial/redação aparecem; treinamento excluído | `emProcesso` no detalhe inclui treinamento (naming divergente da lista) |
| D — Em treinamento | **OK (corrigido)** — fora de Candidatos, dentro de Equipe › Em treinamento, com indicador/início/requisitos; busca correta | Detalhe ainda é a tela de "Candidato" com botão "Rejeitar candidato" |
| E — Equipe | OK — abas Ativos/Experiência/Treinamento/Afastados/Desligados; cada um na sua aba | Badge de status sem cor distinta; bônus sem dados para testar |
| F — Busca | OK — categoria correta; treinamento como "Equipe — Em treinamento"; dedup do par candidato/equipe | Mesma pessoa aparece como "Ficha" + estado atual |
| G — Permissões | **Não testável** (sem usuário de visualização) | Precisa validar antes de produção |
| H — Dashboard/contadores | OK — Em processo (3) = soma das etapas; treinamento/experiência/ativos separados | Sem cards de Efetivados/Rejeitados (opcional) |
| I — PDFs/currículos | Código OK (acesso_total + máscara + vínculo); não reexecutado ao vivo | Validar com visualização |

---

## 3. Problemas encontrados

| Pri | Tipo | Tela/Fluxo | Problema | Impacto | Correção sugerida | Arquivos prováveis |
|---|---|---|---|---|---|---|
| **P1** | Congruência/Dados | Candidatos › Efetivados + Equipe | Pessoa efetivada (Fernanda) aparece em **Candidatos › Efetivados** e também na **Equipe**. Duas representações da mesma pessoa. | RH vê a mesma pessoa em dois lugares; "efetivado" ainda soa como candidato. | Tratar "Efetivados" como histórico do funil (renomear p/ "Concluídos/Histórico" e deixar claro que já são Equipe) ou remover a aba e linkar para a Equipe. | `(interno)/candidatos/page.tsx`, conceito |
| **P1** | Permissão/Segurança | Global | Restrições de "visualização" não validadas ao vivo (sem usuário). | Risco de algo escapar (CPF, currículo, botão) sem ninguém ter conferido. | Criar/!ter um usuário visualização de teste e percorrer os cenários G e I. | `lib/auth.ts`, páginas |
| **P2** | Congruência/UX | Candidato detalhe (em treinamento) | Pessoa em treinamento abre na tela de **Candidato**, com "Registrar em treinamento" e **"Rejeitar candidato"**. A nota explica, mas a moldura é de candidato. | Linguagem operacional errada para quem já entrou. | Trocar rótulos no contexto treinamento ("Encerrar treinamento/Desligar" em vez de "Rejeitar candidato"); título contextual. | `(interno)/candidatos/[id]/page.tsx` |
| **P2** | Lógica | Candidato detalhe (treinamento) | "Rejeitar" um `em_treinamento` volta para status `rejeitado` (candidato), apesar de já ter entrado em operação. | Estado conceitualmente estranho; relatório de funil distorce. | Definir ação própria de "encerrar treinamento" (status dedicado) separada de "rejeitar candidato". | `actions/candidatos.ts` |
| **P2** | Congruência | Fichas | `status` (ciclo) e `status_recrutamento` (funil RH) coexistem sem sincronizar; ao selecionar/efetivar, o funil RH não acompanha. | Dois status que podem se contradizer. | Sincronizar `status_recrutamento` nas transições ou documentar claramente os papéis. | `actions/fichas.ts`, `lib/rh.ts` |
| **P2** | Segurança | Storage/`token_atual` | Token da ficha agora salvo em texto e legível por qualquer leitor de fichas (inclui visualização) → pode abrir o formulário público. | Aceito pelo dono, mas amplia acesso. | (Opcional) exibir link só para acesso_total na UI. | `(interno)/fichas/[id]/page.tsx` |
| **P2** | Segurança | Banco/Auth | Pendências da Fase A: funções SECURITY DEFINER executáveis, proteção de senha vazada desativada, sem rate limit no formulário público. | Endurecimento pré-produção. | Aplicar plano da Fase A (mover funções p/ schema privado, ativar senha vazada, throttle). | migrations, `actions/ficha-publica.ts` |
| **P3** | Congruência | Busca | Mesma pessoa aparece 2x: "Ficha — Selecionada" + estado atual (ex.: "Equipe — Em treinamento"). | Pode confundir. | Priorizar o estado mais avançado ou agrupar por pessoa. | `(interno)/busca/page.tsx` |
| **P3** | Congruência | Fichas › Selecionadas | Ficha permanece "Selecionada" mesmo após virar candidato/treinamento/equipe. | Aba acumula gente que já avançou. | Marcar a ficha como "convertida" ou ocultar selecionadas já viradas candidato. | `actions/fichas.ts` |
| **P3** | Técnico | Candidato lista vs detalhe | Duas definições de "em processo": `STATUS_CANDIDATOS_EM_PROCESSO` (lista, 3 etapas) vs `ETAPAS_ATIVAS` (detalhe, inclui treinamento). | Risco de manutenção/divergência. | Unificar numa única fonte em `lib/equipe-treinamento.ts`. | `(interno)/candidatos/[id]/page.tsx` |
| **P3** | UX | Candidatos/Equipe listas | Badge de etapa (candidatos) sempre azul; badge de status (equipe) sempre cinza — não diferencia por cor. | Leitura rápida prejudicada. | Mapa de cores por etapa/status. | `(interno)/candidatos/page.tsx`, `equipe/page.tsx`, `lib/constants.ts` |
| **P3** | Dados | Bônus | Sem dados fake de bônus e provável `valor_bonus_indicacao` não configurado → fluxo de bônus não testável visualmente. | Não dá para validar a ponta do fluxo. | (Sem alterar dados agora) — relatar; depois popular cenário de indicação→efetivação→bônus. | `configuracoes`, seed |

---

## 4. Problemas de congruência (resumo)

- **"Efetivado" ainda vive como Candidato.** A pessoa efetivada continua na aba Candidatos › Efetivados e também na Equipe. Conceitualmente, efetivado já é Equipe.
- **Detalhe de "em treinamento" usa linguagem de candidato** (botões "Rejeitar candidato", "Registrar em treinamento"), apesar da nota correta de que já está na Equipe.
- **Ficha "Selecionada" é eterna** — não reflete que a pessoa já virou candidato/treinamento/equipe.
- **Busca lista a mesma pessoa em dois itens** (documento Ficha + estado atual).
- **Duas fontes de verdade de status** na ficha (`status` × `status_recrutamento`) e duas definições de "em processo" no código.

## 5. Problemas de lógica de negócio

- Rejeitar alguém **em treinamento** o devolve a "rejeitado" (candidato), sem um conceito de "encerrar treinamento".
- O funil RH (`status_recrutamento`) não avança junto com o processo (fica em "nova ficha"/manual).
- Bônus depende de `valor_bonus_indicacao` (provavelmente não setado) → aparece "valor pendente de configuração".

## 6. Problemas de UX / mobile

- **Mobile 390px não verificável ao vivo** nesta sessão (a janela do navegador tem largura mínima do SO e não encolhe). Avaliação por código: layouts são responsivos (cards, grids `sm:`, sem tabelas). Recomendo validar no DevTools do Mac as telas densas (detalhe de candidato, edição de equipe, formulário público).
- Badges sem cor por etapa/status (listas) — leitura rápida prejudicada.
- Tela de candidato em treinamento mistura ações de seleção e de operação.

## 7. Problemas de segurança / permissão

- **Não validado com usuário de visualização** (cenários G/I) — bloqueio principal de confiança.
- Token da ficha em texto, legível por qualquer leitor de fichas.
- Pendências Fase A: SECURITY DEFINER, senha vazada, rate limit.
- Positivos confirmados no código: `/api/arquivo` exige acesso_total + valida vínculo do path; CPF mascarado para visualização (telas + PDF); currículo/redação escondidos; dados bancários só acesso_total (código + RLS).

## 8. Problemas de dados / contadores

- Dashboard coerente nesta amostra: Em processo (3) = online (1) + presencial (0) + redação (2); Equipe separa ativos (2) / experiência (1) / treinamento (1) / afastados (1) / desligados (1). Treinamento **não** entra em ativo nem efetivado. ✓
- **Efetivado conta como Candidato › Efetivado e existe na Equipe** — não há card de dashboard somando os dois, mas as listas mostram a duplicidade conceitual.
- Sem dados de bônus para validar somatórios de indicação.

## 9. Funcionalidades / ajustes que faltam

- Conceito de **"encerrar treinamento"** (em vez de rejeitar candidato).
- **Sincronizar/relacionar** ficha↔candidato↔equipe para evitar a pessoa em múltiplas listas (ou rótulos claros de "histórico").
- **Configuração de bônus** na interface + dados de indicação para teste.
- **Usuário de visualização** de teste para QA de permissões.
- Cores de status por etapa; cards de Efetivados/Rejeitados no dashboard (opcional).
- Validação mobile real 390px.

---

## 10. Plano de correção por fases

**Fase 0 — Urgências de lógica/congruência**
- Resolver "efetivado em dois lugares" (renomear/裡 reposicionar a aba Efetivados como histórico, deixando claro que já são Equipe).
- Ação dedicada de "encerrar treinamento" separada de "rejeitar candidato"; ajustar linguagem do detalhe em treinamento.
- Unificar a definição de "em processo" (uma fonte só).

**Fase 1 — Segurança / permissões**
- Testar com usuário de visualização (G/I); aplicar pendências da Fase A (REVOKE/schema privado, senha vazada, rate limit); decidir exibição do link só p/ acesso_total.

**Fase 2 — UX e mobile**
- Cores de status por etapa; revisão 390px; rótulos contextuais.

**Fase 3 — Relatórios e exportações**
- Funil, taxas, tempo médio por etapa, contratados/mês, indicações/bônus; exportar Excel/CSV.

**Fase 4 — Novas funcionalidades**
- Agenda de entrevistas; tags; campos de gestão; configuração de bônus na UI.

---

## 11. Próximo prompt recomendado (Fase 0)

> "Execute a Fase 0 da auditoria de fluxo. Sem deploy, commit, push, migration sem pedir, nem alterar dados fake. (1) Resolva a duplicidade do efetivado: a pessoa efetivada não deve mais parecer um 'candidato' — me proponha (a) renomear a aba Candidatos › Efetivados para um histórico claramente rotulado e linkando para a Equipe, ou (b) removê-la; aplique a opção que eu aprovar. (2) No detalhe de quem está `em_treinamento`, troque a linguagem de seleção por operação: substitua 'Rejeitar candidato' por uma ação de 'Encerrar treinamento' e ajuste o título/seções; me explique se precisa de novo status antes de mexer no banco. (3) Unifique a definição de 'em processo' numa única fonte (`lib/equipe-treinamento.ts`) usada por lista e detalhe. Rode `npm run typecheck`, me mostre o git status e explique cada mudança antes de implementar."

---

## 12. Validações técnicas

- `npm run typecheck` → **passou (exit 0)**.
- `npm test` / `npm run build` → **rodar no Mac** (vitest não roda no sandbox por arquitetura de CPU). Há testes novos relevantes: `tests/equipe-treinamento.test.tsx` e `tests/efetivacao-sem-duplicidade.test.ts`.
- Nenhuma alteração de código/banco/dados nesta auditoria.

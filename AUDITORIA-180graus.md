# Auditoria completa — Sistema de Recrutamento 180 Graus

**Data:** 15/06/2026 · **Escopo:** análise somente-leitura pós-implementação da nova identidade visual.
**Não houve** alteração de código, banco, dados ou ambiente.

---

## 1. Resumo executivo

**Nível de maturidade: Beta avançado (~80% de um produto interno pronto).**

O sistema é mais completo do que um protótipo: tem fluxo de ponta a ponta (ficha pública → painel RH → seleção → processo seletivo por etapas → efetivação → equipe → bônus por indicação), RLS em todas as tabelas, papéis de acesso, logs de auditoria, exportação em PDF, currículos em buckets privados com URL assinada e a nova identidade visual aplicada de forma consistente. `npm run typecheck` passa limpo.

**Pode ir para produção agora?** Quase. Recomendo **não** liberar antes de concluir a **Fase A** (curta): corrigir o acesso a arquivos, limpar os dados fake e endurecer alguns pontos de segurança. Nenhum é um bug que "quebra o uso", mas são riscos reais de dados pessoais e de operação.

**Maiores riscos:**

1. **Acesso a currículos/redações sem checagem de papel** — qualquer usuário logado (inclusive "visualização") consegue gerar link assinado de qualquer arquivo nos buckets. (ALTO)
2. **Dados fake no banco de produção, sem script de limpeza.** (ALTO operacional)
3. **Sem rate limit no formulário público** (spam/abuso de storage). (MÉDIO)
4. **Funções SECURITY DEFINER executáveis por usuários logados** e **proteção de senha vazada desativada** (apontados pelo advisor do Supabase). (MÉDIO/BAIXO)

---

## 2. O que está funcionando bem

- **Arquitetura limpa**: Next 15 (App Router) + Server Components + Server Actions, Supabase SSR, separação por domínio em `actions/`, helpers em `lib/`.
- **Segurança de base sólida**: RLS habilitado nas 11 tabelas; `dados_bancarios` restrito a `acesso_total` (no código **e** no RLS); token de ficha guardado como hash SHA-256, com expiração e apagado após o envio; middleware protege rotas internas; buckets privados com URL assinada de 5 min.
- **Fluxos completos**: geração de link, preenchimento público em 7 etapas, validações condicionais (moradia, renda extra, filhos), upload validado, seleção para processo, registro de etapas com avanço automático ("passou" → próxima etapa), efetivação para equipe, bônus por indicação, desligamento.
- **Auditoria**: `audit_logs` registra praticamente toda ação de escrita.
- **Exclusão lógica**: observações, desligamento e arquivamento são lógicos — não há `delete` destrutivo em lugar nenhum.
- **Identidade visual nova**: azul 180 + laranja, logo aplicada (sidebar, login, formulário público), sidebar no desktop, barra inferior no mobile, dashboard repaginado. Sem erros de console.
- **Exportação PDF** por ficha/candidato/equipe, com dados bancários só para `acesso_total`.

---

## 3. Problemas encontrados

Prioridade: **P0** quebra o uso · **P1** atrapalha muito · **P2** melhoria importante · **P3** polimento.

| Pri | Área | Problema | Impacto | Como corrigir | Arquivos prováveis |
|-----|------|----------|---------|---------------|--------------------|
| **P1** | Segurança | `/api/arquivo` só verifica se há login, não o papel nem o vínculo do arquivo. "Visualização" e qualquer logado baixa qualquer currículo/redação sabendo o path (previsível: `{id}/curriculo-…`). | Exposição de dado pessoal (currículo) a quem não deveria; IDOR por path. | Decidir política (currículo é visível para "visualização"?); validar que o `path` pertence a um registro existente; opcionalmente exigir `acesso_total`. | `src/app/api/arquivo/route.ts` |
| **P1** | Dados/Operação | Dados fake no banco de produção e **nenhum script de limpeza**. | Risco de ir para produção com lixo; limpeza manual é arriscada. | Criar script SQL idempotente e reversível para zerar fichas/candidatos/equipe de teste (preservando `perfis`/`configuracoes`). | `supabase/` (novo script) |
| **P1** | Banco | `candidatos` não tem unicidade por `ficha_id`/`cpf` (só `equipe.cpf` é único). | Possível candidato duplicado a partir da mesma ficha. | Adicionar `unique(ficha_id)` em `candidatos` (migration futura). | migration nova |
| **P2** | Segurança | 3 funções `SECURITY DEFINER` (`is_acesso_total`, `is_usuario_ativo`, `papel_atual`) executáveis via RPC por `authenticated`. | Advisor WARN; superfície desnecessária. | `REVOKE EXECUTE` dessas funções de `authenticated` (são usadas só dentro do RLS). | migration nova |
| **P2** | Segurança | Sem rate limit no formulário público (`enviarFichaPublica`/`buscarFichaPorToken`). | Spam de envios, abuso de storage. | Throttle por IP/token (ex.: Upstash, ou tabela de tentativas). | `actions/ficha-publica.ts` |
| **P2** | Segurança/Produto | Papel "visualização" enxerga CPF, currículos e PDFs com dados pessoais. | Pode ferir privacidade se não for intencional. | Confirmar a política; mascarar CPF/ocultar currículo para "visualização" se necessário. | páginas internas, `api/arquivo`, `api/pdf` |
| **P2** | UX/Frontend | Não há `loading.tsx`, `error.tsx` nem `not-found.tsx`. Navegação entre páginas server-side fica "travada" sem feedback; erros caem na tela genérica do Next. | Sensação de lentidão; erro feio. | Adicionar skeletons de loading e boundary de erro amigável. | `src/app/(interno)/` |
| **P2** | UX/Frontend | `ConfirmSubmit` usa `window.confirm` nativo (feio, bloqueante), inconsistente com o `ConfirmInline` (de 2 passos, bonito). | Quebra a experiência nas ações críticas. | Padronizar tudo no estilo `ConfirmInline`/modal próprio. | `components/ConfirmSubmit.tsx` e usos |
| **P2** | Frontend | Sem indicador de "salvando" nos formulários internos (server actions sem estado pendente). | Usuário clica 2x, não sabe se salvou. | `useFormStatus`/pending nos botões. | forms em `(interno)/**` |
| **P2** | Modelagem | Dois sistemas de status paralelos: `fichas.status` (ciclo de vida) **e** `fichas.status_recrutamento` (funil RH), além de `candidatos.status` + `candidatos.etapa_atual`. Não há sincronização entre o funil da ficha e o candidato. | Confunde o RH (status que não conversam). | Documentar claramente o papel de cada um, ou consolidar. | `lib/rh.ts`, `lib/constants.ts`, páginas |
| **P3** | Frontend | Badges de status nas **listas** de candidatos (`bg-blue-100` fixo) e equipe (`bg-gray-100` fixo) não usam o mapa de cores por status; ficam todos da mesma cor. | Inconsistência visual; difícil distinguir etapa/status rápido. | Criar mapa de cores por etapa/status de equipe (como já existe em `STATUS_RECRUTAMENTO_CLASSES`). | `candidatos/page.tsx`, `equipe/page.tsx`, `lib/constants.ts` |
| **P3** | Frontend | Várias telas internas ainda usam paleta `gray-*` e títulos `text-xl font-bold` em vez do `slate-*`/`font-display` do novo tema. | Pequena inconsistência com o dashboard. | Padronizar tokens (gray→slate, títulos→font-display). | candidatos, equipe, busca, detalhes, `Observacoes` |
| **P3** | UX | Estados vazios são texto cinza simples ("Nenhum candidato."). | Aparência amadora. | Empty states com ícone + ação sugerida. | listas em `(interno)/**` |
| **P3** | Banco | `status_recrutamento` é `text + check` em vez de `enum` (resto do schema usa enums). | Inconsistência de modelagem. | Migrar para enum quando for mexer no schema. | migration futura |
| **P3** | Banco | FKs sem índice de cobertura e alguns índices sem uso (advisor INFO). | Irrelevante nesta escala; relevante se crescer. | Adicionar índices nas FKs mais consultadas no futuro. | migration futura |
| **P3** | Performance | Dashboard puxa 3 tabelas inteiras e conta em JS; `fichas` puxa `*, ficha_respostas(*)`. | OK hoje (dezenas de linhas); cresce linearmente. | Usar `count`/colunas específicas quando o volume crescer. | `(interno)/page.tsx`, `fichas/page.tsx` |

### Mobile (390px) — observações

Não foi possível capturar 390px ao vivo (a janela do navegador tem largura mínima do SO e não encolhe abaixo de ~500px). A avaliação abaixo é por código (classes responsivas, todas padrão Tailwind):

- **Sem tabelas** no sistema — tudo é card; o maior risco de overflow horizontal está mitigado por design. (Bom)
- Sidebar vira **barra inferior** no mobile; conteúdo sem padding lateral indevido (`md:pl-60` só no desktop). (Bom)
- Formulários usam grids `sm:grid-cols-*` que **empilham** no mobile; inputs `w-full`; botões `w-full sm:w-auto`. (Bom)
- Formulário público é **mobile-first** (`max-w-lg`), com botões grandes Sim/Não e barra de progresso. (Bom)
- **Recomendação P2:** validar no Mac (DevTools 390px) o detalhe de candidato (formulário "Registrar etapa") e a edição de equipe, que são os formulários mais densos.

---

## 4. Funcionalidades faltantes (visão "RH usando no dia a dia")

| Pri | Funcionalidade | Por que importa | Complexidade | Dependências |
|-----|----------------|-----------------|--------------|--------------|
| Alta | **Agenda de entrevistas** (data/hora futura, responsável, status, lembrete) | Hoje a etapa só é registrada **depois**; não há agendamento nem lembrete. | Média | Tabela nova `entrevistas` ou campos em `candidato_etapas`; opcional: e-mail/WhatsApp |
| Alta | **Limpeza segura de dados fake** | Pré-requisito para produção. | Baixa | Script SQL |
| Alta | **3º papel (RH edição)** além de Admin total e Visualização | Spec pede 3 níveis; hoje só escrita = `acesso_total`. | Média | RLS + `requirePerfil` com novo papel |
| Média | **Motivo de rejeição/arquivamento estruturado** (lista + texto) | Relatórios e padronização. | Baixa | Enum/coluna |
| Média | **Pontuação/avaliação da entrevista** (nota estruturada, não só "passou/não passou") | Comparar candidatos objetivamente. | Média | Colunas em `candidato_etapas` |
| Média | **Tags/etiquetas** (bom p/ produção, indicação forte, chamar depois…) | Triagem rápida. | Média | Tabela `tags` + N:N |
| Média | **Priorização automática** (pontuar por requisitos: notebook, veículo, CNH, disponibilidade, formação) | Ordenar fila de fichas. | Baixa-Média | Já existe `requisitosPrincipais`; faltam ordenação/peso |
| Média | **Campos de gestão**: responsável pelo candidato, data próxima entrevista, prioridade, origem padronizada (`origem_vaga` hoje é texto livre) | Operação real do funil. | Média | Schema |
| Média | **Histórico de status da ficha visível** (existe em `audit_logs`, mas não na tela) | Rastreabilidade para o RH. | Baixa | Surfacing dos logs |
| Média | **Configurações na interface** (ex.: `valor_bonus_indicacao`, dias de expiração) | Hoje só via SQL; bônus aparece "pendente de configuração". | Baixa | Tela admin sobre `configuracoes` |
| Média | **Exportações**: candidatos/equipe em Excel/CSV; relatório de funil | Trabalho do RH fora do sistema. | Média | Lib de planilha; PDF já existe |
| Média | **Relatórios/Dashboard analítico**: fichas recebidas, candidatos por etapa, taxa de rejeição, tempo médio por etapa, contratados/mês, indicações | Gestão. | Média-Alta | Queries agregadas |
| Baixa | **Comunicação**: templates de WhatsApp, registrar "contato feito" | Hoje só copiar link/WhatsApp na ficha. | Baixa-Média | Coluna de contatos |
| Baixa | **Anexos além do currículo** (RG, certificados) | Completar cadastro. | Média | Storage + colunas |
| Baixa | **Gestão de equipe**: histórico de cargos/salários, alerta de fim de experiência | RH de pessoal. | Média | Tabela de histórico |
| Baixa | **Auditoria visível ao admin** (tela de logs) | Compliance. | Baixa | Surfacing de `audit_logs` |

---

## 5. Plano de correção por fases

**Fase A — Obrigatória antes do deploy (curta, baixo risco)**
- Corrigir `/api/arquivo` (checagem de papel/vínculo do arquivo).
- Definir e aplicar política de privacidade do papel "visualização" (CPF/currículo).
- `REVOKE EXECUTE` nas funções `SECURITY DEFINER`; ativar proteção de senha vazada.
- Criar script seguro de limpeza dos dados fake (sem rodar ainda).
- Adicionar `error.tsx`/`not-found.tsx` amigáveis.

**Fase B — UX/RH importante**
- Padronizar confirmação (sair do `window.confirm`), estados de loading/salvando, empty states com ícone.
- Mapa de cores por status nas listas (candidatos/equipe); padronizar `gray→slate` e títulos `font-display`.
- Tornar `configuracoes` editável na interface (bônus, expiração).

**Fase C — Funcionalidades novas**
- Agenda de entrevistas + lembretes; 3º papel (RH edição); tags; campos de gestão (responsável, prioridade, próxima entrevista, origem padronizada); motivo estruturado de rejeição.

**Fase D — Relatórios/Exportações**
- Excel/CSV de candidatos/equipe; relatório de funil; dashboard analítico (taxas, tempo médio, contratados/mês).

**Fase E — Segurança e permissões avançadas**
- Rate limit do formulário público; tela de auditoria para admin; índices de FK; consolidar políticas RLS permissivas duplicadas (advisor).

**Fase F — Polimento final**
- Remover colunas legadas de `ficha_respostas`; `status_recrutamento` → enum; revisão fina mobile 390px; acessibilidade.

---

## 6. Recomendações de implementação por fase

| Fase | O que fazer | Agente ideal | Chrome? | Terminal/Codex? | Planejamento | Testes | Risco de quebrar |
|------|-------------|--------------|---------|------------------|--------------|--------|------------------|
| A | Segurança de arquivos, RLS/funções, script de limpeza, error boundaries | Claude (backend/segurança) | Pouco | Sim (terminal p/ migrations locais e revisão) | Recomendado revisar a política de privacidade antes | typecheck + teste manual de `/api/arquivo` com os 2 papéis | Médio (mexe em API e RLS) |
| B | Padronização visual, loading/empty/confirm, settings UI | Claude + Chrome (validação visual) | Sim | Pouco | Leve | Visual desktop+mobile, typecheck | Baixo |
| C | Agenda, papéis, tags, campos de gestão | Claude/Codex (full-stack) + planejamento prévio | Sim | Sim (migrations) | **Forte** (modelagem antes) | Unit + e2e dos novos fluxos | Médio-Alto (schema novo) |
| D | Exportações e relatórios | Codex no terminal (queries/lib) | Pouco | Sim | Médio | Conferir números com dados reais | Baixo |
| E | Rate limit, auditoria, índices, RLS | Claude (segurança) | Não | Sim | Médio | Carga/segurança | Médio |
| F | Limpeza de schema, enum, a11y | Claude/Codex | Sim | Sim | Leve | Regressão completa | Baixo-Médio |

> Use **Claude + Chrome** para tudo que tem validação visual (B, C, F). Use **terminal/Codex** para migrations, queries e exportações (A, C, D, E). Use um modelo de **planejamento/revisão** (ex.: GPT-5.x Thinking) antes da **Fase C**, que envolve modelagem de schema — é onde o risco de inconsistência é maior.

---

## 7. Checklist antes do deploy

- [ ] **Banco**: `unique(ficha_id)` em candidatos; revisar status duplicados; (opcional) índices de FK.
- [ ] **Segurança**: `/api/arquivo` com checagem de papel; `REVOKE EXECUTE` nas funções SECURITY DEFINER; rate limit no público; política de "visualização" definida.
- [ ] **Auth**: ativar proteção de senha vazada (HaveIBeenPwned) no painel Supabase; trocar a senha temporária do usuário inicial.
- [ ] **Variáveis de ambiente**: `SUPABASE_SERVICE_ROLE_KEY` (já preenchida ✓), `NEXT_PUBLIC_APP_URL` apontando para o domínio de produção; conferir na Vercel.
- [ ] **Build**: `npm run build` verde **no Mac** (confirmar `next/font` baixando as fontes).
- [ ] **Testes**: `npm test` e `npm run test:e2e` no Mac (no sandbox falham só por arquitetura).
- [ ] **Dados fake**: rodar o script de limpeza em produção; conferir contagens zeradas.
- [ ] **Git**: sem segredos commitados (`.env.local` está no `.gitignore` ✓).
- [ ] **Vercel**: variáveis de ambiente configuradas; `NEXT_PUBLIC_APP_URL` correto (afeta o link da ficha).
- [ ] **Supabase Storage**: buckets `curriculos`/`redacoes` privados ✓; revisar políticas de Storage.
- [ ] **Permissões**: testar com um usuário "visualização" real (não deve escrever; conferir o que enxerga).
- [ ] **Mobile**: validar 390px em DevTools (formulários densos + público).
- [ ] **Formulário público**: testar fim-a-fim (link → preencher → enviar → aparece no painel) com a URL de produção.
- [ ] **Currículos**: confirmar que só quem deve consegue abrir/baixar.

---

## 8. Mapa do sistema (referência)

**Páginas:** `login` · `(interno)`: dashboard, `fichas` + `fichas/[id]`, `candidatos` + `candidatos/[id]`, `equipe` + `equipe/[id]` + `equipe/nova`, `busca` · público: `ficha/[token]`.
**API:** `GET /api/arquivo` (URL assinada de currículo/redação), `GET /api/pdf/[tipo]/[id]` (PDF de ficha/candidato/equipe).
**Actions:** `ficha-publica` (buscar/enviar), `fichas` (criar/regerar link, status RH, arquivar, rejeitar, selecionar, editar), `candidatos` (registrar etapa+avanço, rejeitar, efetivar), `equipe` (cadastrar, editar, desligar, bônus), `observacoes` (criar/editar/apagar lógico).
**Tabelas (11, todas com RLS):** `perfis`, `fichas`, `ficha_respostas`, `candidatos`, `candidato_etapas`, `equipe`, `dados_bancarios`, `bonus_indicacao`, `observacoes`, `audit_logs`, `configuracoes`.
**Enums:** papel_usuario, status_ficha, status_candidato, tipo_etapa, resultado_etapa, status_equipe, origem_equipe, entidade_tipo, status_bonus, disponibilidade_viajar_t (+ `status_recrutamento` como text/check).

---

## 9. Validação técnica (resultado)

- `npm run typecheck` → **PASSOU**, sem erros.
- `npm test` → **não executável no sandbox** (binário nativo do vitest/rolldown é de outra arquitetura). Rodar no Mac. Há testes unitários (`tests/*.test.ts(x)`) e e2e (Playwright).
- `npm run build` → **inicia e compila** sem erro de binário nativo; não concluiu no limite de tempo do sandbox. Rodar completo no Mac (atenção ao download de fontes do `next/font`).
- Supabase advisors → 4 avisos de **segurança** (3 SECURITY DEFINER + senha vazada) e vários de **performance** (FKs sem índice, índices sem uso, políticas permissivas duplicadas) — todos detalhados na seção 3.

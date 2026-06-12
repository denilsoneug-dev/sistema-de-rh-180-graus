# Sistema de Recrutamento 180 Graus

CRM interno de recrutamento e equipe: fichas com link individual, processo seletivo em 4 etapas, efetivação, equipe atual, bônus por indicação, busca por nome/CPF e exportação PDF.

Stack: Next.js 14 + TypeScript + Tailwind + Supabase (Auth, Database, Storage). Deploy: Vercel.

## Como rodar localmente

1. Instale as dependências:
   ```
   npm install
   ```
2. Configure o `.env.local` (já incluído com URL e chave anon do projeto Supabase `recrutamento-180-graus`). Falta apenas 1 chave:
   - Abra https://supabase.com/dashboard/project/oghasluhglnzrfjqhzpx/settings/api-keys
   - Copie a **service_role key** e cole em `SUPABASE_SERVICE_ROLE_KEY=` no `.env.local`
   - Sem ela, o painel interno funciona, mas a ficha pública (link do candidato) e o upload de redação não funcionam.
3. Rode:
   ```
   npm run dev
   ```
4. Acesse http://localhost:3000

## Login inicial

- E-mail: denilson10eugenio@gmail.com
- Senha: Mudar@180graus  ← troque depois no painel do Supabase (Authentication → Users)

Se o login falhar, redefina a senha desse usuário no painel do Supabase.

## Criar os outros usuários

No painel do Supabase → Authentication → Add user (com "Auto Confirm User"). O perfil é criado automaticamente com papel `visualizacao`. Para dar acesso total, rode no SQL Editor:

```sql
update perfis set papel = 'acesso_total' where email = 'email@dapessoa.com';
```

## Deploy na Vercel

1. Suba o projeto para um repositório Git (GitHub).
2. Importe na Vercel e configure as variáveis de ambiente (as mesmas do `.env.local`), trocando `NEXT_PUBLIC_APP_URL` pela URL final (ex.: `https://recrutamento180.vercel.app`).
3. `NEXT_PUBLIC_APP_URL` é usada para montar o link da ficha enviado ao candidato — precisa estar correta.

## Configurações (tabela `configuracoes`)

- `valor_bonus_indicacao`: defina o valor quando decidido (enquanto nulo, aparece "pendente de configuração")
- `dias_expiracao_link` = 14
- Alertas de atraso: 7 dias (entrevistas/redação), 15 dias (treinamento)

## Segurança implementada

- RLS em todas as tabelas; escrita somente para `acesso_total`
- `dados_bancarios` invisível para o papel `visualizacao` (nem chega no payload)
- Token do link da ficha: aleatório (32 bytes), salvo só como hash SHA-256; gerar novo link invalida o antigo; expira ao enviar
- Buckets privados (`curriculos`, `redacoes`) com URLs assinadas de 5 minutos, só para logados
- Soft delete em observações; auditoria automática em `audit_logs`
- CPF validado com dígito verificador, salvo limpo, exibido formatado

# Canção Incentiva: como colocar o site no ar

Este pacote é o site completo da Canção Incentiva. Ele roda em quatro serviços, e todos têm plano gratuito para começar:

| Serviço | Para que serve | Custo |
|---|---|---|
| **Cloudflare Pages** | Hospeda o site e o servidor | Grátis, inclusive para uso comercial |
| **Supabase** | Banco de dados e login das pessoas | Grátis no início |
| **Anthropic (Claude)** | A IA que monta diagnósticos e projetos | Pré-pago, cobrado pelo uso |
| **Mercado Pago** | Pagamento por Pix, cartão ou boleto | Taxa por venda aprovada |

Separe uns 60 a 90 minutos para fazer tudo com calma. Anote cada chave num bloco de notas enquanto avança, porque você vai usá-las no passo 5.

> **Importante:** as chaves "service_role", da Anthropic e do Mercado Pago são **secretas**. Nunca as coloque em arquivos, no GitHub ou em mensagens. Elas só entram no painel da Cloudflare (passo 5).

---

## 1. Banco de dados (Supabase)

1. Acesse **supabase.com** e crie uma conta (pode usar a conta do Google).
2. Clique em **New project**.
   - Nome: `cancao-incentiva`
   - Database password: crie uma senha forte e guarde.
   - Region: **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1 a 2 minutos).
4. No menu da esquerda, abra **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/schema.sql` deste pacote, copie **todo** o conteúdo, cole no editor e clique em **Run**. Deve aparecer "Success".
6. Vá em **Project Settings** (engrenagem) → **API** e anote:
   - **Project URL** (algo como `https://abcd.supabase.co`) → será o `SUPABASE_URL`
   - **anon public** → será o `SUPABASE_ANON_KEY`
   - **service_role** (clique em "Reveal") → será o `SUPABASE_SERVICE_ROLE_KEY` (secreta)
7. Vá em **Authentication** → **Sign In / Providers** → **Email** e **desligue "Confirm email"**. Assim a pessoa entra logo depois de criar a conta, sem precisar abrir o e-mail. Isso é o mais simples para quem tem pouca prática com celular.

## 2. Chave da IA (Anthropic)

1. Acesse **console.anthropic.com** e crie uma conta.
2. Em **Billing**, adicione créditos (por exemplo, US$ 20 para começar). Defina também um **limite mensal de gasto**, para nunca ter surpresa.
3. Em **API Keys**, clique em **Create Key**, dê o nome `cancao-incentiva` e copie a chave (começa com `sk-ant-`) → será o `ANTHROPIC_API_KEY` (secreta).

O site usa o modelo **Claude Sonnet 5.5**. Um diagnóstico custa centavos. Um projeto completo, com todos os campos perto do limite de caracteres, sai por volta de US$ 0,60 (poucos reais). O site também limita o uso por pessoa: 12 diagnósticos e 12 planilhas por dia.

## 3. Pagamento (Mercado Pago)

1. Acesse **mercadopago.com.br/developers** com a conta Mercado Pago da Canção.
2. Vá em **Suas integrações** → **Criar aplicação**.
   - Nome: `Canção Incentiva`
   - Tipo de pagamento: **Pagamentos online** → **Checkout Pro**.
3. Abra a aplicação → **Credenciais de produção** → copie o **Access Token** (começa com `APP_USR-`) → será o `MP_ACCESS_TOKEN` (secreta).

> Para testar sem cobrar de verdade, use primeiro as **Credenciais de teste** e depois troque pelas de produção.

## 4. Guardar o código (GitHub)

A Cloudflare publica o site a partir do GitHub.

1. Crie uma conta em **github.com**.
2. Clique em **New repository**.
   - Nome: `cancao-incentiva`
   - Marque **Private**.
   - Clique em **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Descompacte o arquivo `.zip` no seu computador. Selecione **tudo o que está dentro da pasta** (as pastas `functions`, `lib`, `public`, `supabase` e os arquivos soltos), arraste para a página do GitHub e clique em **Commit changes**.
   - Confira se as pastas aparecem com os mesmos nomes no GitHub, e não dentro de outra pasta.

## 5. Colocar no ar (Cloudflare Pages)

1. Acesse **dash.cloudflare.com** e crie uma conta.
2. No menu, abra **Workers & Pages** → **Create** → aba **Pages** → **Connect to Git**.
3. Conecte sua conta do GitHub e escolha o repositório `cancao-incentiva`.
4. Em **Build settings**:
   - Framework preset: **None**
   - Build command: *(deixe vazio)*
   - Build output directory: `public`
5. Abra **Environment variables (advanced)** e adicione uma a uma. Nas secretas, use o tipo **Secret**.

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | Project URL do passo 1 |
| `SUPABASE_ANON_KEY` | chave anon public do passo 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service_role do passo 1 (Secret) |
| `ANTHROPIC_API_KEY` | chave do passo 2 (Secret) |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` |
| `MP_ACCESS_TOKEN` | Access Token do passo 3 (Secret) |
| `SITE_URL` | deixe para depois (passo 6) |

6. Clique em **Save and Deploy**. Em 1 a 2 minutos aparece o endereço do site, algo como `https://cancao-incentiva.pages.dev`.

## 6. Ajustes finais

1. **Endereço do site:** na Cloudflare, em **Settings** → **Variables and Secrets**, adicione `SITE_URL` com o endereço do passo anterior (sem barra no final). Depois vá em **Deployments** e clique em **Retry deployment** no último item, para aplicar.
2. **Supabase:** em **Authentication** → **URL Configuration**, coloque o mesmo endereço em **Site URL**. Isso faz o link de "Esqueci minha senha" voltar para o site.
3. **Tornar-se administrador:**
   - Abra o site, toque em **Entrar** → **Sou novo aqui** e crie sua conta com `rafael.anotti@gmail.com`.
   - No Supabase, abra o **SQL Editor**, cole o comando abaixo e clique em **Run**:

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'rafael.anotti@gmail.com';
   ```

   - Recarregue o site. A aba **Gestão** aparece no menu.
4. **Configurações:** em **Gestão** → **Configurações**, preencha o preço do projeto completo, o WhatsApp, o e-mail e a mensagem. Sem preço, o botão de pagamento não aparece.
5. **Teste completo:** com outra conta (ou um e-mail de teste), monte um projeto, gere o diagnóstico e compre o projeto completo. Use as credenciais de teste do Mercado Pago ou um Pix de valor baixo. Depois do pagamento, o site volta sozinho e libera o projeto.

---

## Como funciona o pagamento

1. A pessoa toca em **Comprar projeto completo** → **Pagar com Pix, cartão ou boleto**.
2. Ela vai para o Mercado Pago, paga e volta para o site.
3. O Mercado Pago avisa o site, que confere o pagamento e libera o projeto na hora. Pix confirma em segundos; boleto pode levar até 3 dias úteis.
4. Quem preferir combinar pelo WhatsApp toca em **Prefiro combinar pelo WhatsApp**. O pedido aparece em **Gestão → Projetos completos**, e você libera com **Pagamento recebido · liberar**.

## Endereço próprio (depois)

Quando quiser um endereço como `projetos.cancaoconsultoria.com.br`, vá na Cloudflare em **Custom domains** → **Set up a custom domain** e siga as instruções. Depois atualize o `SITE_URL` e o **Site URL** do Supabase com o novo endereço.

## Bom saber

- **Supabase gratuito:** o projeto pausa se ficar 7 dias sem nenhum acesso. Com o site em uso, isso não acontece. Se pausar, basta entrar no painel e clicar em **Restore**.
- **Atualizar o site:** qualquer arquivo alterado no GitHub publica uma nova versão automaticamente.
- **Regras e textos da IA:** ficam no arquivo `public/regras.js` (limites das leis, campos do SALIC e do SLI, instruções da IA). Ao mudar uma norma, é esse arquivo que se atualiza.
- **Onde ficam os dados:** Supabase → **Table Editor** mostra cadastros, projetos, pedidos e contatos.

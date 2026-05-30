# Variáveis de Ambiente — Vercel

Guia passo a passo para configurar as variáveis do Firebase no Vercel.

---

## 1. Onde adicionar

1. Acesse [vercel.com](https://vercel.com) e abra seu projeto
2. Vá em **Settings** → **Environment Variables**
3. Para cada variável abaixo, clique em **Add** e preencha:
   - **Name** → o nome exato (ex: `VITE_FIREBASE_API_KEY`)
   - **Value** → o valor copiado do Firebase Console
   - **Environments** → marque **Production**, **Preview** e **Development**

---

## 2. Variáveis necessárias

| Name | Onde encontrar no Firebase |
|------|---------------------------|
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project Settings → General → Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Project Settings → General → `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Project Settings → General → Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Project Settings → General → `<project-id>.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Project Settings → General → Sender ID |
| `VITE_FIREBASE_APP_ID` | Project Settings → General → App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Project Settings → General → Measurement ID (opcional) |

> **Onde achar tudo de uma vez:** Firebase Console → ⚙️ Configurações do Projeto → aba **Geral** → seção **Seus apps** → clique no app web → **Configuração do SDK** → selecione **Configuração** (não CDN).

---

## 3. Configuração do projeto no Vercel

Na aba **Settings** → **General** do projeto, configure:

| Campo | Valor |
|-------|-------|
| **Root Directory** | `artifacts/apex-sorveteria` |
| **Build Command** | `pnpm build` |
| **Output Directory** | `dist/public` |
| **Install Command** | `pnpm install` |

> O arquivo `vercel.json` dentro de `artifacts/apex-sorveteria/` já define o `buildCommand`, `outputDirectory` e os rewrites de SPA automaticamente — você pode deixar os campos acima em branco se preferir.

---

## 4. Domínios autorizados no Firebase

Após o deploy, adicione o domínio Vercel no Firebase para liberar o login:

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Clique em **Add domain**
3. Adicione: `seu-projeto.vercel.app` (e o domínio personalizado, se houver)

---

## 5. Redeploy após adicionar as variáveis

Sempre que adicionar ou alterar variáveis no Vercel, faça um novo deploy:

- Na aba **Deployments** → clique nos `...` do último deploy → **Redeploy**

---

## Exemplo de valores (formato)

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=apex-sorveteria.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=apex-sorveteria
VITE_FIREBASE_STORAGE_BUCKET=apex-sorveteria.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXX
```

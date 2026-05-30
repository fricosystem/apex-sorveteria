# Plano de Migração para Firestore (Persistência Total)

## 🚨 O Problema Atual (Por que não salva?)

Atualmente, o sistema já possui a estrutura do Firestore codificada (`src/lib/firestore-service.ts` e as coleções configuradas). No entanto, as operações de salvamento falham silenciosamente (ou retornam erro 500) pelo seguinte motivo:

1. A interface (Frontend) faz requisições HTTP para as rotas da API do Next.js (ex: `fetch('/api/produtos')`).
2. As rotas da API rodam no **servidor (Node.js)** e chamam as funções do `firestore-service.ts`.
3. O `firestore-service.ts` utiliza o **Client SDK do Firebase** (`firebase/firestore`).
4. Como as rotas rodam no backend, o Client SDK "perde" o contexto de autenticação do usuário logado no navegador. Como resultado, o Firestore bloqueia as leituras e escritas por falta de permissão (pois as regras de segurança exigem um usuário logado).

Além disso, há um rastro de banco de dados SQLite/Prisma (`prisma/schema.prisma`) que sugere uma arquitetura anterior não totalmente removida.

---

## 🛠️ A Solução Proposta

Temos dois caminhos para resolver o problema de persistência. A **Abordagem 1** é a mais recomendada.

### Abordagem 1: Comunicação Direta pelo Frontend (Recomendado ⭐)

A principal vantagem de utilizar o Firebase é que você **não precisa de uma API intermediária (backend)**. Podemos acessar o banco de dados diretamente dos componentes do React. 

Como o usuário já está logado no frontend, o Firebase Client SDK enviará automaticamente o token de autenticação, e o Firestore autorizará a gravação.

**Plano de Ação:**
1. **Refatorar os Componentes**: Atualizar `produtos-view.tsx`, `caixa-view.tsx`, `vendas-view.tsx`, `dashboard-view.tsx`, etc., removendo as chamadas de `fetch('/api/...')`.
2. **Uso Direto do Serviço**: Substituir os `fetch` pelas chamadas diretas às funções já criadas no `firestore-service.ts` (ex: `await FS.createDocument(COLLECTION.PRODUTOS, data)`).
3. **Remover APIs Antigas**: Excluir com segurança as rotas em `src/app/api/` (já que não serão mais utilizadas para as operações de CRUD).
4. **Remover Prisma**: Excluir a pasta `prisma` para evitar confusões de arquitetura no futuro.

*Benefícios: Menos código para dar manutenção, maior performance, suporte mais fácil para persistência offline e dados em tempo real no futuro.*

### Abordagem 2: Refatorar as Rotas da API para usar o Admin SDK (Alternativa)

Se o seu objetivo é obrigatoriamente forçar os dados a passarem por uma camada de segurança ou lógica fechada em rotas de API no servidor.

**Plano de Ação:**
1. O Frontend (React) precisará capturar o token JWT do Firebase (`user.getIdToken()`) e enviar no cabeçalho `Authorization` do `fetch`.
2. Modificar todas as rotas em `src/app/api/...` para validar esse token.
3. Usar a instância do Firebase Admin SDK (`src/lib/firebase-admin.ts`) dentro das rotas da API para efetuar as operações de banco de dados com privilégios de administrador (ignorando as regras restritas).

---

## 🚀 Próximos Passos

Para que eu possa corrigir o sistema imediatamente, preciso que você responda:

**Podemos seguir com a Abordagem 1 (Comunicação Direta Frontend ↔ Firestore)?**
Isso tornará o sistema mais rápido e aproveitará todo o potencial do `firestore-service.ts` que já está criado. Assim que aprovar, eu realizarei a refatoração do código para que tudo passe a ser salvo e carregado corretamente no banco de dados.

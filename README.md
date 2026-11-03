# Petstore API — Hono + Neon + Vercel

API REST didática, sem autenticação, com documentação Swagger UI.

## Instalação
1. Crie um banco PostgreSQL no Neon e execute `sql/schema.sql` no SQL Editor.
2. Copie `.env.example` para `.env` e configure `DATABASE_URL`. Nunca envie credenciais ao GitHub.
3. Execute `npm install` e `npm run dev`.
4. Acesse `http://localhost:3000/docs`.

## Deploy
Importe este repositório na Vercel, configure `DATABASE_URL` nas variáveis de ambiente e publique. Novos commits no branch principal disparam deploys automáticos após conectar o GitHub à Vercel.

## Endpoints
- `/docs`: Swagger UI
- `/openapi.json`: especificação OpenAPI
- `/health`: saúde da API
- `/pet`, `/pet/{petId}`, `/pet/findByStatus`
- `/store/inventory`, `/store/order`, `/store/order/{orderId}`
- `/user`, `/user/{username}`

**Atenção:** protótipo para dados fictícios. Antes de uso público intenso, implemente rate limiting persistente, cotas e limpeza periódica de dados. Não use dados pessoais reais.

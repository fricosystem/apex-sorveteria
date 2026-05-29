# Task 8 — Migrate Dashboard, Seed, Profile/Stats APIs from Prisma/SQLite to Firestore

**Agent:** full-stack-developer
**Date:** 2025-07-10

## Work Log

### File 1: `src/app/api/dashboard/route.ts` — COMPLETE REWRITE

Migrated from Prisma/SQLite to pure Firestore queries. Key changes:

- **Single-query optimization**: Instead of N+1 day-by-day DB calls for `lucroPorDia` (original pattern), now fetches ALL vendas and compras in the maximum needed date range with a single Firestore query each, then groups by day in JavaScript.
- **Date range calculation**: Identical to original (startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, custom range support via query params).
- **Parallel Firestore reads**: 4 concurrent reads — vendas (max range, status=Concluida), compras (max range, status=Concluida), vendasRecentes (top 5, any status, ordered by dataVenda desc), active produtos.
- **JS-side aggregation**: `totalHoje`, `totalSemana`, `totalMes`, `totalCompras` computed by filtering vendasData/comprasData arrays by date range.
- **lucroPorDia**: Groups vendas by date string for revenue+quantity, groups compras by date string for cost, merges per-day entries, generates all dates in range.
- **receitaPorDia**: Reuses vendasByDay map from the same max-range query, extracts last 7 days.
- **produtosMaisVendidos**: Filters vendas to month/custom range, fetches `itens` subcollections in parallel, aggregates by produtoId with nomeProduto, sorts desc, takes 5.
- **vendasRecentes**: Uses raw `docToData()` for proper Timestamp→ISO conversion, fetches `itens` subcollections via `FS.listSubDocuments()`.
- **estoqueBaixo**: Filters active produtos where `estoque < 5`, sorts ascending.
- **Response format**: Exact same JSON structure as original (totalHoje, totalSemana, totalMes, totalCompras, lucroBruto, lucroPorDia, produtosMaisVendidos, receitaPorDia, vendasRecentes, totalProdutos, estoqueBaixo).

### File 2: `src/app/api/seed/route.ts` — COMPLETE REWRITE

- Same 24 seed products preserved exactly (all names, descriptions, prices, costs, categories, stock levels).
- Uses `FS.listDocuments()` to check for existing products (returns early if any exist).
- Uses `writeBatch(db)` for efficient single-round-trip batch write.
- Each product gets: CUID2 id via `FS.generateId()`, `ativo: true`, `createdAt: serverTimestamp()`, `updatedAt: serverTimestamp()`.
- Response: `{ message, total: 24, categorias: [...] }` matching original format.

### File 3: `src/app/api/profile/route.ts` — UPDATED

- **GET**: Firestore user document fetch unchanged. Replaced Prisma aggregations (`db.venda.aggregate()`, `db.compra.aggregate()`, `db.produto.count()`, `db.caixa.count()`) with parallel Firestore `getDocs()` calls on vendas, compras, produtos (where ativo==true), and caixa collections. Aggregates in JS (sum total/totalCusto, count documents).
- **PUT**: Already pure Firestore, no changes needed (just removed unused `toDate` import).

### File 4: `src/app/api/profile/stats/route.ts` — UPDATED

- Same pattern as profile GET: replaced all 4 Prisma queries with parallel Firestore `getDocs()` calls, JS-side aggregation.
- `membroDesde` fetch from Firestore user document preserved (with graceful fallback).

## Technical Details

- **No `@/lib/db` imports**: All 4 files now exclusively use `firebase/firestore` and `@/lib/firebase` + `@/lib/firestore-service`.
- **Raw Firestore queries**: Dashboard uses raw `getDocs(query(...))` for aggregation (no `docToData` overhead), `docToData` only for response formatting.
- **Timestamp handling**: `toDate()` from firestore-service converts Firestore Timestamps, ISO strings, Date objects, and numbers to JS Date for comparison.
- **Batch operations**: Seed route uses `writeBatch` for efficient multi-document creation.
- **Error handling**: All routes maintain try/catch with proper HTTP status codes.

## Verification

- ESLint: zero warnings/errors
- Dev server: compiles and runs without errors
- No `@/lib/db` imports in any of the 4 migrated files

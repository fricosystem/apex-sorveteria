# Task ID: 5 — Migrate Compras API routes from Prisma/SQLite to Firebase Firestore

## Agent: full-stack-developer

## What was done

Migrated both Compras API route files from Prisma/SQLite to Firebase Firestore using the existing `firestore-service.ts` service layer.

### Files Modified

1. **`src/app/api/compras/route.ts`** — Complete rewrite
   - **GET**: Lists compras with optional `?dataInicio=&dataFim=` date filtering using `Timestamp.fromDate()`, orders by `dataCompra desc`, fetches `itens` subcollection for each compra via `listSubDocuments()`
   - **POST**: Validates at least 1 item, verifies all products exist in Firestore `produtos` collection, calculates `totalCusto`, gets sequential number via `getNextNumber('compras')`, creates compra doc with `generateId()` + `serverTimestamp()`, creates itens subdocuments via `addSubDocument()`, atomically increments stock via `incrementStock()`, returns created compra with itens at status 201

2. **`src/app/api/compras/[id]/route.ts`** — Complete rewrite
   - **GET**: Fetches single compra by ID with its `itens` subcollection via `listSubDocuments()`, returns 404 if not found
   - **DELETE**: Verifies compra exists (404 if not), deletes all items via `deleteSubCollection()`, then deletes the compra document, returns success message

### Key Patterns Used

- `FS.COLLECTIONS.COMPRAS` / `FS.COLLECTIONS.PRODUTOS` for collection name constants
- `FS.generateId()` for CUID2 IDs
- `FS.getNextNumber('compras')` for atomic sequential numbering
- `FS.getDocument()` / `FS.listDocuments()` for reading
- `FS.createDocumentWithId()` for creating compra
- `FS.addSubDocument()` for creating items in `compras/{id}/itens`
- `FS.listSubDocuments()` for fetching item subcollections
- `FS.deleteSubCollection()` + `FS.deleteDocument()` for cascade deletion
- `FS.incrementStock()` for atomic batch stock updates
- `Timestamp.fromDate()` for date range query constraints
- `serverTimestamp()` for dataCompra field
- `import { db } from '@/lib/firebase'` (no more `@/lib/db`)

### Verification

- ESLint: zero warnings/errors
- Dev server compiles clean (no errors)
- No other files modified

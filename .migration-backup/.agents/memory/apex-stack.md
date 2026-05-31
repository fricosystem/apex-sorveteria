---
name: APEX Sorveteria stack
description: Tech stack and architecture of the APEX Sorveteria project
---
- Web: Vite + React + Tailwind (shadcn/ui) in artifacts/apex-sorveteria/
- Mobile: Expo React Native in artifacts/apex-sorveteria-mobile/
- Data: Firebase Auth + Firestore client SDK directly (no custom API for web app)
- Monorepo: pnpm workspaces
- Secrets: 7x VITE_FIREBASE_* env vars (already configured in Replit)
- firebase-admin TypeScript errors in firebase-admin.ts are pre-existing, do not affect Vite builds
- Vercel config: vercel.json at root, outputDirectory: artifacts/apex-sorveteria/dist/public

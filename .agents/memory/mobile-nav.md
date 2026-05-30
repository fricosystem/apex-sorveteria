---
name: Mobile navigation pattern
description: How mobile navigation is structured in App.tsx and Caixa view
---
- Bottom nav bar: fixed bottom-0, z-30, h-14, md:hidden — 5 tabs (Dashboard, Produtos, Compras, Caixa, Perfil)
- Hamburger menu (Menu icon, md:hidden) in header still exists for sidebar access
- main element has pb-14 md:pb-0 to avoid content hidden behind bottom nav
- Caixa floating cart bar: fixed bottom-14 md:bottom-0, z-40 — sits ABOVE bottom nav on mobile
- Caixa product grid: pb-32 md:pb-20 lg:pb-2 — accounts for bottom nav + cart bar on mobile
**Why:** Bottom nav gives one-tap access to all sections on mobile vs. hamburger-only navigation.

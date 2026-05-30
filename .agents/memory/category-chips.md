---
name: Category filter chips pattern
description: How category filter chips work in Produtos and Caixa views
---
Both views (produtos-view.tsx, caixa-view.tsx) use native <button> elements styled as badge pills.
CATEGORY_COLORS map defines per-category color classes (bg-*/text-*/border-*).
Active state: "Todas" → rose-600 filled; other categories → their CATEGORY_COLORS.
Inactive state: muted-foreground text, default border, hover effect.
cn() utility is imported from @/lib/utils in both files.
**Why:** Using <Button> with rounded-full looked too heavy/button-like; badge chips are smaller, lighter, more tag-like as the user wanted.

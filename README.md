# Run As You Are

15-årsjubilerande jaktstartslopp — och en iOS-app under uppbyggnad som ska
göra det roligare att leva i under själva loppet: startordning, livekarta,
resultatarkiv och tidtagning.

**Projektplan (levande dokument):** https://claude.ai/code/artifact/4213f2bc-e2c0-4dcd-ae72-d01fe54c5da7

## Struktur

```
run-as-you-are/
├── functions/          Poängmotorn — startordning, placeringspoäng,
│                       träffsäkerhetsavdrag. Ren JS, inga backend-beroenden
│                       ännu, tänkt att bli en Supabase Edge Function.
│   ├── scoring-engine.js
│   ├── scoring-engine.test.js
│   └── package.json
├── docs/
│   └── PLAN.md         Kort sammanfattning + länk till den fulla planen ovan.
└── ios/                (kommer) — SwiftUI-appen. Skapas när Xcode-projektet
                         dras igång.
```

## Kom igång

```bash
cd functions
npm test        # kör de 15 testfallen för poängmotorn
```

Ingen build krävs för `functions/` än — den är avsiktligt fri från
backend-beroenden så logiken går att verifiera fristående innan den
kopplas in i ett Supabase-projekt (Postgres + Auth + Edge Functions).

## Nuvarande status

Se roadmap-tabellen ("Rekommenderad startlista") i projektplanen för
byggordning. Just nu: poängmotorns logik är skriven och testad; racedag-
skelettet, onboarding-flödet och SwiftUI-appen är nästa steg.

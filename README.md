# Run As You Are

15-årsjubilerande jaktstartslopp — och en iOS-app under uppbyggnad som ska
göra det roligare att leva i under själva loppet: startordning, livekarta,
resultatarkiv och tidtagning.

**Projektplan (levande dokument):** https://claude.ai/code/artifact/4213f2bc-e2c0-4dcd-ae72-d01fe54c5da7

## Struktur

```
run-as-you-are/
├── functions/                    Poängmotorns FÖRSTA prototyp, i Node.
│   ├── scoring-engine.js         Bevarad som referens — samma logik som
│   ├── scoring-engine.test.js    supabase/functions/scoring, bara i JS/Node
│   └── package.json              istället för Deno/TS. Den som faktiskt
│                                  deployas är den under supabase/.
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql         Hela schemat: runners, editions, predictions,
│   │                             start_list, results + RLS-policyer + två
│   │                             vyer för säsongstotalen. Körd och verifierad
│   │                             mot en lokal Postgres innan den hamnade här.
│   └── functions/scoring/
│       ├── index.ts              Edge Function-wrappern (HTTP-lagret).
│       └── _shared/
│           ├── scoring-engine.ts       Samma poängmotor, Deno/TS-port.
│           └── scoring-engine.test.ts  9 gröna tester, samma facit som Node-versionen.
├── docs/
│   └── PLAN.md                   Kort sammanfattning + länk till den fulla planen ovan.
└── ios/                          (kommer) — SwiftUI-appen. Skapas när
                                   Xcode-projektet dras igång.
```

## Kom igång

```bash
# Poängmotorn, Node-versionen
cd functions && npm test

# Poängmotorn, Deno/Supabase-versionen (kräver Deno: https://deno.com)
cd supabase/functions/scoring/_shared && deno test scoring-engine.test.ts

# Type-check av själva Edge Function-wrappern
cd supabase/functions/scoring && deno check index.ts
```

Inget av det ovan kräver ett riktigt Supabase-projekt — logiken är
avsiktligt fri från backend-beroenden. `supabase/migrations/0001_init.sql`
är testad mot en lokal Postgres (tabeller, RLS-policyer och vyer,
inklusive att gissningar verkligen döljs innan loppet är avslutat och att
man inte kan gissa i någon annans namn). Nästa steg är att köra samma
migration mot ett riktigt Supabase-projekt.

## Sätta upp det riktiga Supabase-projektet

Se [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) — steg för steg,
`brew install` till `supabase functions deploy`, plus ett rök-test på slutet.

## Nuvarande status

Se roadmap-tabellen ("Rekommenderad startlista") i projektplanen för
byggordning. Just nu: poängmotorns logik och databasschemat är skrivna och
testade (Node + Deno + lokal Postgres). Kvar: skapa det riktiga
Supabase-projektet, racedag-skelettet, onboarding-flödet och SwiftUI-appen.

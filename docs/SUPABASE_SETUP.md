# Sätta upp det riktiga Supabase-projektet

Körs i din vanliga Terminal på din Mac (inte via Claude) — det här steget
kräver din inloggning. Du har `brew` redan, så det är den snabbaste vägen in.

## 1. Installera CLI:t

```bash
brew install supabase/tap/supabase
supabase --version
```

## 2. Logga in

```bash
supabase login
```
Öppnar en flik i webbläsaren — logga in precis som för fiftytwoormore.

## 3. Skapa projektet

Enklast i dashboarden (samma flöde du känner igen): gå till
[supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
→ döp det till `run-as-you-are` → välj region (Stockholm/`eu-north-1` om
det finns, annars närmaste EU-region) → spara databaslösenordet som visas,
det behövs inte igen men bra att ha undanstoppat.

## 4. Koppla ihop mappen med projektet

```bash
cd ~/run-as-you-are
supabase init      # skapar bara supabase/config.toml, rör inte våra befintliga filer
supabase link      # be dig välja projektet du just skapade
```

## 5. Kör vårt schema mot det riktiga projektet

```bash
supabase db push
```

Det här applicerar `supabase/migrations/0001_init.sql` — alla fem
tabeller, RLS-policyerna, och de två vyerna för säsongstotalen. Redan
testat mot en lokal Postgres (se `docs/PLAN.md`), så det här är i praktiken
en formalitet, men bra att se att den går igenom rent mot riktiga
Supabase-Postgres också.

Kolla i dashboarden → **Table Editor** att alla fem tabeller dök upp.

## 6. Slå på Sign in with Apple

Dashboarden → **Authentication → Providers → Apple**. Kräver en Service ID
och nyckel från din Apple Developer-portal — det brukar vara det mest
pilliga steget i hela uppsättningen. Vi kan hoppa över det tills
racedag-skelettet faktiskt behöver logga in någon; fram tills då går det
bra att testa med e-post/magic link istället.

## 7. Deploya Edge Function

```bash
supabase functions deploy scoring
```

`SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` (som `index.ts` läser via
`Deno.env.get`) finns redan tillgängliga automatiskt för alla Edge
Functions i projektet — inget att sätta manuellt i produktion.

## 8. Rök-test

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/scoring" \
  -H "Authorization: Bearer <din anon-key, från dashboarden Settings → API>" \
  -H "Content-Type: application/json" \
  -d '{"action":"compute-start-list","editionId":"00000000-0000-0000-0000-000000000000"}'
```

Ett påhittat `editionId` finns inte i databasen än, så du bör få
`{"error":"Okänd edition"}` med statuskod 404 tillbaka — det är själva
beviset på att funktionen är uppe och pratar med databasen, inte ett fel.

## Lokal utveckling utan att deploya varje gång

```bash
supabase start                    # kör hela stacken lokalt i Docker
supabase functions serve scoring  # servar funktionen lokalt, hot-reload
```

`supabase start` ger dig en riktig lokal Postgres MED auth-schemat redan på
plats — bättre än den handgjorda `local-test-shims.sql` som bara användes
för att verifiera migrationen i Claudes sandlåda.

---

Klart? Nästa steg i roadmapen är racedag-skelettet: ett tomt SwiftUI-projekt
med deltagarlista, invite-flöde och en tom MapKit-karta.

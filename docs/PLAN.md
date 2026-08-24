# Projektplan — sammanfattning

Fullständig, uppdaterad plan (design, arkitektur, datamodell, risker):
**https://claude.ai/code/artifact/4213f2bc-e2c0-4dcd-ae72-d01fe54c5da7**

Den sidan är källan till sanning och uppdateras löpande. Det här dokumentet
är bara en snabbreferens för när man är inne i koden och inte vill lämna
editorn.

## Kärnbeslut hittills

- **Plattform:** SwiftUI (rent iOS, inget cross-platform-lager). Alla i
  gänget har iPhone.
- **Backend:** Supabase — Postgres + Auth + Edge Functions. Redan i bruk i
  fiftytwoormore, och maratontabellens data är i grunden relationell.
- **Livespårning (MVP):** telefonens egen GPS strömmas direkt via en
  Supabase Realtime Broadcast-kanal, ingen Garmin/Apple Watch-integration
  krävs för att den ska fungera, och ingen tabell behöver skrivas till för
  varje position. Garmin LiveTrack-länk och HealthKit-import är tillägg,
  inte beroenden.
- **Distribution:** TestFlight, inte App Store. Kom ihåg: builds går ut
  efter 90 dagar.

## Byggordning

1. Racedag-skelett + onboarding (namn + skattad 10km-tid)
2. Livespårning
3. Startordning + gissningsspel (förväntad sluttid för de utan förra året)
4. Resultat & historik (import av alla 15 år)
5. Tidtagning + poängmotor

## Poängmotorn — tre lager

1. **Placering** — lägre är bättre (golf-stil).
2. **NI/DNR/DNC** — sista plats +2 / +2 / +4 poäng.
3. **Träffsäkerhetsavdrag** — belönar en bra gissning i gissningsspelet,
   oavsett om det var självskattning eller en kompis som gissade:
   - ≤ 1 min fel → −2 poäng
   - ≤ 5 min fel → −1 poäng
   - mer fel än det → inget avdrag

Implementerat och testat på två ställen, samma facit:
- `functions/scoring-engine.js` (Node, ursprungsprototypen — `npm test` → 15/15 gröna)
- `supabase/functions/scoring/_shared/scoring-engine.ts` (Deno, den som faktiskt
  deployas — `deno test` → 9/9 gröna)

## Datamodell (Postgres-tabeller)

`runners`, `editions`, `predictions`, `start_list`, `results` — vanliga
foreign keys, Row Level Security för t.ex. att stänga gissningsrundan för
sena gissningar och att dölja andras gissningar tills loppet är avslutat.
Liveposition under loppet lagras inte i en tabell alls; den strömmas via
Broadcast och finns bara medan loppet pågår. En `live_pings`-tabell är
valfri om ni vill kunna spela upp loppet efteråt.

Schemat (`supabase/migrations/0001_init.sql`) är körd mot en lokal
Postgres och verifierad: samma säsongstotal som `scoring-engine`-testerna
räknar fram, och RLS-policyerna beter sig rätt (gissningar dolda innan
loppet är klart, ingen kan gissa i någon annans namn). Kvar: köra samma
migration mot ett riktigt Supabase-projekt, och koppla
`supabase/functions/scoring/index.ts` (som väntar på `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`) mot det.

## Öppna frågor

- Median eller medelvärde för att slå ihop gissningar till "förväntad
  sluttid"? Just nu: median (robust mot skämtgissningar).

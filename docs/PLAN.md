# Projektplan — sammanfattning

Fullständig, uppdaterad plan (design, arkitektur, datamodell, risker):
**https://claude.ai/code/artifact/4213f2bc-e2c0-4dcd-ae72-d01fe54c5da7**

Den sidan är källan till sanning och uppdateras löpande. Det här dokumentet
är bara en snabbreferens för när man är inne i koden och inte vill lämna
editorn.

## Kärnbeslut hittills

- **Plattform:** SwiftUI (rent iOS, inget cross-platform-lager). Alla i
  gänget har iPhone.
- **Backend:** Firebase — Firestore + Auth + Cloud Functions. Firestores
  realtidslyssnare bär livekartan.
- **Livespårning (MVP):** telefonens egen GPS delas till Firestore var
  5–15 sek, ingen Garmin/Apple Watch-integration krävs för att den ska
  fungera. Garmin LiveTrack-länk och HealthKit-import är tillägg, inte
  beroenden.
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

Implementerat och testat i `functions/scoring-engine.js`
(`npm test` → 15/15 gröna).

## Öppna frågor

- Median eller medelvärde för att slå ihop gissningar till "förväntad
  sluttid"? Just nu: median (robust mot skämtgissningar).

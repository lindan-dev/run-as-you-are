-- Rätta två felaktiga 2023-rader från originalarket.
--
-- Joakim Andrèasson och Niclas Norlèn var "NI" (Not Invited) 2023, men
-- "Tid"-cellen var tom istället för ifylld med "NI" — importen (0003)
-- tolkade det som ett riktigt lopp med placering 9. Daniel bekräftade
-- att båda ska vara NI, vilket ger placering = sistaplats(2023) + 2 = 7,
-- inte 9. Detta var ett litet fel som redan låg i originalarket (deras
-- "Poäng"-summa i arket är 2p för hög för samma anledning) — appens
-- egna uträkning är nu mer korrekt än det gamla arkets facit.

update results
set placering = null, status = 'NI', finish_time_sec = null
where edition_id = (select id from editions where year = 2023)
  and runner_id = (select id from runners where name = 'Joakim Andrèasson');

update results
set placering = null, status = 'NI', finish_time_sec = null
where edition_id = (select id from editions where year = 2023)
  and runner_id = (select id from runners where name = 'Niclas Norlèn');

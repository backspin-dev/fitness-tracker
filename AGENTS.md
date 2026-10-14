# Fitness tracker

Dit is een kleine Nederlandse webapp voor iPhone. Houd de bediening eenvoudig,
de app licht en de privacyregels hieronder intact.

## Grenzen

- Het volledige trainingslogboek en alle herstelkopieën blijven in IndexedDB
  op het toestel. Geen online trainingsdatabase, trainingssynchronisatie of
  online back-up. Oefennamen, datums, gewichten, afzonderlijke sets/reps en
  lichaamsmetingen mogen nooit worden verstuurd.
- De optionele Supabase-ranglijst mag uitsluitend na expliciet **Meedoen** de
  openbare alias en totale repscore publiceren, met de technische anonieme
  identiteit en bijwerkdatum die nodig zijn voor de score. Geen gebruikerslogin
  met e-mail of wachtwoord toevoegen. Anonieme sessies staan apart in lokale
  browseropslag en mogen nooit in logboekexports of lokale herstelkopieën komen.
- Namen zijn niet uniek. Scores zijn zelf gerapporteerd. Beloof geen verificatie
  van prestaties of herstel van een oude ranglijstidentiteit op een ander toestel.
- Geen analytics, trackers of externe lettertypen/resources toevoegen. Alleen
  de expliciete ranglijstverbinding vormt een uitzondering op lokaal gebruik.
- De openbare repository en app bevatten geen persoonlijke oefeningen,
  gewichten, screenshots, exports, sessietokens of andere trainingsgegevens.
- Handmatige JSON-back-ups worden bewust geëxporteerd of geïmporteerd voor
  overdracht of opslag buiten de app. Verstuur ze nergens heen en zet ze nooit
  in Git. Automatische herstelkopieën worden uitsluitend lokaal gemaakt.
- Alleen publieke Supabase-projectconfiguratie en publishable/anon-sleutels
  mogen in de app staan; nooit secret-, service-role- of ontwikkelaarsinloggegevens.
  Backendconfiguratie gebeurt door de ontwikkelaar, niet door eindgebruikers.
- Geen bibliotheken, package manager, buildstap of extra backend toevoegen zonder
  aantoonbare noodzaak. Gebruik HTML, CSS en JavaScript.
- Behoud relatieve URL's: de app werkt onder `/fitness-tracker/` én onder `/`.
- Respecteer andere projecten op dezelfde GitHub Pages-origin: verwijder nooit
  caches of databases die niet specifiek bij deze app horen.

## Ontwikkeling

- `index.html`, `styles.css` en `app.js`: interface en bediening. Eén oefening
  heeft per trainingsdag één gewicht, aantal sets en reps per set.
- `groups-ui.js`: schema's kiezen, eigen onderdelen, hernoemen, verbergen en
  terugzetten. Verbergen bewaart oefeningen en geschiedenis.
- `progress-ui.js`: voortgangsscherm en lichaamsgewicht invoeren.
- `stats.js` en `stats.css`: statistieken en grafieken zonder externe resources.
  Totale herhalingen zijn de som van **sets × reps** over opgeslagen trainingen;
  de repsgrafiek toont **reps per set**. Klaargezette trainingen tellen pas na
  bewaren mee; aanpassen van een opgeslagen dag vervangt die dag.
- `data.js`: gegevensmodel, migratie, opslag en JSON-validatie. Schemaversie 3
  bevat `groups`, `routines`, `sessions`, `bodyWeights` en de optionele `ui`.
  Oefeningen bevatten `id`, `name`, `weight`, `reps` en `sets` (heel getal 1–99).
  Accepteer versies 1 en 2 uit lokale opslag en back-ups. Migreer oude oefeningen
  naar één set, zodat oude reptotalen gelijk blijven. Verlies geen IDs,
  oefeningen, gewichten, reps, trainingsdatums, onderdelen of lichaamsmetingen.
  De gevalideerde huidige toestand en JSON-back-up mogen maximaal 6 MiB zijn.
- `recovery.js`: maximaal zeven lokale herstelkopieën, laatste gewijzigde versie
  per dag plus beschermde toestand vóór importeren of terugzetten. Dedupliceer
  dezelfde inhoud; alleen `ui` wijzigen maakt geen kopie. Ongeldige kopieën mogen
  het bewaren van een geldig logboek niet blokkeren. `saveState` bewaart current
  en kopieën in dezelfde IndexedDB-transactie; een fout draait beide terug en
  mag nooit als succesvol opgeslagen worden getoond. Gebruik aparte keys zonder
  een databaseversieverhoging. Exporteer alleen het actuele logboek, geen kopieën.
- `recovery-ui.js`: lokale kopieën bekijken en expliciet terugzetten. Een geldige
  kopie moet met de editorlock ook bij een beschadigde huidige toestand kunnen
  worden teruggezet; vóór die expliciete actie niets overschrijven.
- `backup-reminder.js`: helpers voor gegevensdetectie en validatie van oude
  herinneringsmetadata. De vroegere herinnering na 14 dagen wordt niet meer
  aangeboden; begin die flow niet opnieuw bij oude metadata.
- `leaderboard.js`, `leaderboard-ui.js` en `leaderboard-config.js`: optionele
  alias/scoreverbinding, bediening en publieke configuratie. `supabase/schema.sql`
  bevat toegangsregels en scorefuncties; `supabase/README.md` beschrijft installatie. Netwerkfouten mogen lokaal opslaan nooit blokkeren.
  Beveilig writes met de anonieme identiteit; een alias is geen autorisatie.
- `sw.js`: offline app-shell. Verhoog `CACHE_VERSION` als een gecachet bestand
  verandert. Cache uitsluitend openbare appbestanden, nooit Supabase-antwoorden
  of sessietokens. Installeer updates pas na toestemming in de app of het sluiten
  van oude vensters; onderbreek nooit ongemerkt lopende invoer.
- `manifest.webmanifest` en de iconen: installatie op het beginscherm.
- GitHub Pages publiceert de hoofdmap van `main`; een workflow is niet nodig.

Gebruik voor lokaal testen een HTTP-server, bijvoorbeeld `python3 -m http.server
8000`, en open `http://localhost:8000/`. Open de HTML niet via `file://`.

Controleer JavaScript-syntaxis van gewijzigde modules met `node --check` en voer
de model-, herstel-, herinnerings-, statistiek- en ranglijsttests uit met
`node --test tests/*.test.mjs`.
Controleer bij relevante wijzigingen op een mobiel scherm: sets/reps/gewicht
bewaren na herladen, afzonderlijke invoer per onderdeel, vorige training
(inclusief sets) automatisch overnemen, datumwissels, toevoegen en verwijderen.
Controleer wisselen tussen Push/Pull/Legs, Full body en Upper/Lower, eigen
onderdelen, hernoemen en verbergen/terugzetten zonder verlies van geschiedenis.
Controleer lege grafieken, gewicht/reps per set, totale sets × reps,
lichaamsgewicht per datum en trainingstellingen. Trainingstellingen betreffen
niet-lege opgeslagen trainingen, geen voltooiingsstatus.

Controleer geldige en ongeldige JSON-back-ups, versie-1-/versie-2-migratie en
versie-3-export/import met sets, eigen onderdelen en lichaamsgewicht. Controleer
migratie van een oud bestand vlak onder 5 MiB naar de nieuwe limiet van 6 MiB.
Controleer herstel na herladen, maximaal zeven kopieën, vervanging van de dagkopie,
bescherming vóór import/herstel, corrupt current met geldige kopie en rollback
bij een opslagfout. Alleen de actuele toestand hoort in de handmatige export.

Controleer ranglijstdeelname zonder gebruikerslogin: alias plus totaalscore,
geen netwerkpublicatie vóór expliciet meedoen, alleen eigen score kunnen wijzigen,
offline en netwerkfouten, verlopen anonieme sessies en geen sessie in JSON.
Controleer offline openen na eerste installatie, de updateknop en werking onder
een subdirectory. Een andere browser begint met een leeg logboek. Gebruik geen
echte gebruikersgegevens in tests of openbare voorbeelden.

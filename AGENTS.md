# Fitness tracker

Dit is een kleine Nederlandse webapp voor iPhone. Houd de bediening eenvoudig,
de app licht en de privacyregels hieronder intact.

## Grenzen

- Trainingsgegevens blijven in IndexedDB op het toestel. Geen accounts,
  gebruikersdatabase, analytics, trackers of externe lettertypen/resources.
- De openbare repository en app bevatten geen persoonlijke oefeningen,
  gewichten, screenshots, exports of andere trainingsgegevens als voorbeelddata.
- Back-ups zijn bestanden die de gebruiker bewust exporteert of importeert.
  Verstuur ze nergens heen. Zet ze nooit in Git.
- Geen bibliotheken, package manager, buildstap of backend toevoegen zonder
  aantoonbare noodzaak. Gebruik HTML, CSS en JavaScript.
- Behoud relatieve URL's: de app werkt onder `/fitness-tracker/` én onder `/`.
- Respecteer andere projecten op dezelfde GitHub Pages-origin: verwijder nooit
  caches of databases die niet specifiek bij deze app horen.

## Ontwikkeling

- `index.html`, `styles.css` en `app.js`: interface en bediening.
- `groups-ui.js`: schema's kiezen, eigen onderdelen, hernoemen, verbergen en
  terugzetten. Verbergen bewaart oefeningen en geschiedenis.
- `progress-ui.js`: voortgangsscherm en lichaamsgewicht invoeren.
- `stats.js` en `stats.css`: statistieken en grafieken zonder externe resources.
- `data.js`: gegevensmodel, migratie, opslag en back-upvalidatie. Schemaversie 2
  bevat `groups`, `routines`, `sessions`, `bodyWeights` en de optionele `ui`.
  Blijf versie 1 uit lokale opslag en back-ups accepteren en verlies bij migratie
  geen IDs, oefeningen, gewichten, reps of trainingsdatums.
- `backup-reminder.js`: lokale herinnering; ook alleen lichaamsgewicht telt als
  gegevens waarvoor een back-up nodig is. Herinneringsmetadata zit apart van de
  geëxporteerde gegevens.
- `sw.js`: offline app-shell. Verhoog `CACHE_VERSION` als een gecachet bestand
  verandert. Installeer updates pas na toestemming in de app of het sluiten van
  de oude vensters; onderbreek nooit ongemerkt een lopende invoer.
- `manifest.webmanifest` en de iconen: installatie op het beginscherm.
- GitHub Pages publiceert de hoofdmap van `main`; een workflow is niet nodig.

Gebruik voor lokaal testen een HTTP-server, bijvoorbeeld `python3 -m http.server
8000`, en open `http://localhost:8000/`. Open de HTML niet via `file://`.

Controleer JavaScript-syntaxis van gewijzigde modules met `node --check` en voer
de model-, herinnerings- en statistiektests uit met `node --test tests/*.test.mjs`.
Controleer bij relevante wijzigingen op een mobiel scherm: wijzigingen bewaren
na herladen, afzonderlijke invoer per onderdeel, vorige training automatisch
overnemen, datumwissels, toevoegen en verwijderen. Controleer wisselen tussen
Push/Pull/Legs, Full body en Upper/Lower, eigen onderdelen, hernoemen en
verbergen/terugzetten zonder verlies van geschiedenis. Controleer lege grafieken,
gewicht/reps per oefening, lichaamsgewicht per datum en trainingstellingen.
Trainingstellingen betreffen niet-lege opgeslagen trainingen, geen voltooiingsstatus;
er zijn geen afzonderlijke sets of berekend trainingsvolume.

Controleer geldige en ongeldige back-ups, versie-1-migratie en een versie-2-
export/import met eigen onderdelen en lichaamsgewicht. Controleer offline openen
na eerste installatie, de updateknop, en werking onder een subdirectory. Een andere
browser moet met een leeg logboek beginnen. Geen echte gebruikersgegevens in
tests opnemen.

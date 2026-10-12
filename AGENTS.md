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
- `data.js`: gegevensmodel, opslag en back-upvalidatie.
- `sw.js`: offline app-shell. Verhoog `CACHE_VERSION` als een gecachet bestand
  verandert. Installeer updates pas na toestemming in de app of het sluiten van
  de oude vensters; onderbreek nooit ongemerkt een lopende invoer.
- `manifest.webmanifest` en de iconen: installatie op het beginscherm.
- GitHub Pages publiceert de hoofdmap van `main`; een workflow is niet nodig.

Gebruik voor lokaal testen een HTTP-server, bijvoorbeeld `python3 -m http.server
8000`, en open `http://localhost:8000/`. Open de HTML niet via `file://`.

Controleer JavaScript-syntaxis met `node --check app.js`, `node --check data.js`
en `node --check sw.js`. Als er tests in de repository staan, voer die ook uit.
Controleer bij relevante wijzigingen op een mobiel scherm: wijzigingen bewaren
na herladen, afzonderlijke Push/Pull/Legs-invoer, datumwissels, toevoegen en
verwijderen, geldige en ongeldige back-ups, offline openen na eerste installatie,
de updateknop, en werking onder een subdirectory. Een andere browser moet met
een leeg logboek beginnen. Geen echte gebruikersgegevens in tests opnemen.

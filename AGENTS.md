# Fitness tracker

Dit is een kleine Nederlandse webapp voor iPhone. Houd de bediening eenvoudig,
de app licht en de privacyregels hieronder intact.

## Grenzen

- Het volledige trainingslogboek en alle herstelkopieën blijven in IndexedDB
  op het toestel. Geen online trainingsdatabase, trainingssynchronisatie of
  online back-up. Trainingsdatums, gewichten, afzonderlijke sets/reps en
  lichaamsmetingen mogen nooit worden verstuurd.
- De Supabase-ranglijst hoort bij de app. Vraag bij de eerste start één openbare
  naam en leg daar duidelijk uit dat naam, oefenlabels en totalen openbaar worden.
  Na die eenmalige start worden scores automatisch bijgewerkt. Publiceer alleen
  oefensleutel, canonieke catalogusnaam of genormaliseerde eigen oefennaam en
  totaal reps, met de technische anonieme identiteit en bijwerkdatum die nodig
  zijn voor de score. Geen gebruikerslogin met e-mail of wachtwoord toevoegen.
  Anonieme sessies staan apart in lokale browseropslag en mogen nooit in logboekexports of lokale herstelkopieën komen.
- Namen zijn niet uniek. Scores zijn zelf gerapporteerd. Beloof geen verificatie
  van prestaties of herstel van een oude ranglijstidentiteit op een ander toestel.
- Geen eigen analytics, trackers of externe lettertypen/resources toevoegen.
  De ranglijstverbinding en de expliciet geopende YouTube-uitlegvideo's vormen
  uitzonderingen op lokaal gebruik. Laad een speler uitsluitend na openvouwen;
  gebruik youtube-nocookie.com, geen autoplay of externe thumbnails. Stuur geen
  logboekvelden naar de videodienst. Video's zijn online referenties en horen
  nooit in IndexedDB, JSON-back-ups of de serviceworker-cache.
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
  heeft per trainingsdag één gewicht, aantal sets en reps per set. De kop heeft
  compacte toegankelijke knoppen voor Statistieken, Ranglijst, Geschiedenis en
  Instellingen; Fitness brengt je naar Training. Training, Statistieken,
  Ranglijst en Jouw gegevens zijn gewone pagina’s, geen modale dialogen.
  De trainingspagina toont alleen de training en de bijbehorende bediening.
  De ranglijst opent direct met oefenkeuze en scores. Houd normale pagina’s kort
  en overzichtelijk: geen naamformulier of lange uitleg vóór de scores.
  Naam wijzigen staat in Instellingen; alleen de eerste start vraagt verplicht
  één naam met een
  duidelijke melding over de openbare gegevens.
- `navigation.js`: URL-fragmentroutes `#/training`, `#/statistieken`,
  `#/ranglijst` en `#/gegevens`. Ondersteun directe links, herladen en de
  terug-/vooruitknoppen van de browser. Gebruik gewone secties met een
  duidelijke paginatitel en actieve navigatie. Routing mag geen trainingen
  aanmaken, gegevens overschrijven of de lokale opslagcontext veranderen.
  Houd dialogen voor korte bewerkingen, bevestigingen en geschiedenis.
- `groups-ui.js`: schema's kiezen, eigen onderdelen, hernoemen, verbergen en
  terugzetten. Verbergen bewaart oefeningen en geschiedenis.
- `progress-ui.js`: voortgangsscherm en lichaamsgewicht invoeren.
- `stats.js` en `stats.css`: statistieken en grafieken zonder externe resources.
  Totale herhalingen zijn de som van **sets × reps** over opgeslagen trainingen;
  de repsgrafiek toont **reps per set**. Klaargezette trainingen tellen pas na
  bewaren mee; aanpassen van een opgeslagen dag vervangt die dag.
- `exercise-catalog.js`: 150 echte vaste ranglijstoefeningen met onderzoeksbronnen,
  zorgvuldig gekozen aliassen en invoersuggesties. Voeg geen verzonnen
  catalogusoefeningen toe. Normaliseer hoofdletters en witruimte; voeg alleen bekende
  schrijfvarianten samen. Gebruik geen algemene enkelvoud-/meervoudstam of fuzzy
  samenvoeging: apparaat, vrije gewichten en andere wezenlijke uitvoeringen
  blijven onderscheiden. Onbekende namen vormen eigen ranglijsten op basis van
  hoofdletter-, witruimte- en leestekennormalisatie; raad daarbij geen meervoud
  of betekenis. Een handmatige `rankingKey` mag alleen een bekende cataloguskey
  zijn; zonder override wordt de naam automatisch gekoppeld of genormaliseerd.
  Behoud vrijheid met één vrij oefennaamveld, optionele suggesties en een
  ingeklapte ranglijsttoelichting. Geen verplichte extra stap. Behoud bestaande
  catalogussleutels en houd de clientcatalogus gelijk aan de SQL-catalogus;
  opgeslagen koppelingen moeten bruikbaar blijven.
- `exercise-names-ui.js`: korte zichtbare suggestielijst tijdens typen. Vrije
  tekst en opslaan zonder selectie blijven mogelijk. Reserveer een vast
  begrensd vlak voor suggesties, zodat typen, geen resultaten en andere
  resultaten de invoervelden of bewaaractie niet verplaatsen. Laat alleen de
  lijst zelf scrollen wanneer nodig; verplaats de pagina niet bij automatisch
  verversen. Houd de lijst mobiel begrensd en toetsenbordbedienbaar. Toon openbare
  eigen oefennamen als
  Door gebruikers, na catalogussuggesties; promoveer ze niet automatisch naar
  geverifieerde oefeningen. Laad de openbare lijst zonder getypte zoektermen
  te versturen. Alleen reeds gedeelde namen mogen andere gebruikers bereiken.
- `exercise-videos.js` en `exercise-video-ui.js`: gecontroleerde YouTube-referenties
  voor bekende catalogusnamen en aliassen, uitklapbaar op de oefenkaart. Alleen
  echte passende materiaal-/uitvoeringsvarianten koppelen. Geen video tonen bij
  onbekende eigen namen; een handmatige ranglijstkoppeling is geen bewijs van de
  uitvoering. Bewaar onderzoeksbronnen in `video-sources.json`. Ontbrekende goede
  video's blijven ontbrekend; vul geen fictieve IDs of verkeerde varianten in.
  Toon Bron met een directe YouTube-link. Verwijder de iframe bij dichtklappen
  en het verlaten van Training. De iframe geeft alleen de app-origin door via
  strict-origin-when-cross-origin; dat is nodig om YouTube-fout 153 te vermijden.
  Beloof geen advertentievrije, offline of blijvend beschikbare YouTube-video's.
- `data.js`: gegevensmodel, migratie, opslag en JSON-validatie. Schemaversie 4
  bevat `groups`, `routines`, `sessions`, `bodyWeights` en de optionele `ui`.
  Oefeningen bevatten `id`, `name`, `weight`, `reps`, `sets` (heel getal 1–99)
  en optioneel `rankingKey` voor een expliciete ranglijstkoppeling. Accepteer
  versies 1, 2 en 3 uit lokale opslag en back-ups. Migreer oefeningen uit versies
  1 en 2 naar één set,
  zodat oude reptotalen gelijk blijven; versie 3 behoudt de bestaande sets. Vul
  ranglijstkoppelingen automatisch in zonder vrije namen of lokale IDs te wijzigen.
  Voeg bij migratie geen lege `rankingKey`-velden toe. Verlies geen IDs, oefeningen,
  gewichten, reps, trainingsdatums, onderdelen of lichaamsmetingen.
  De gevalideerde huidige toestand en JSON-back-up mogen maximaal 7 MiB zijn.
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
- `leaderboard.js`, `leaderboard-ui.js` en `leaderboard-config.js`: automatische
  alias/scoreverbinding per oefening, eenmalige naamstart en publieke configuratie.
  Ranglijsttotalen tellen sets × reps per canonieke oefening op over onderdelen
  heen; lokale statistieken blijven de eigen oefening- en onderdeel-IDs gebruiken.
  `supabase/schema.sql` bevat toegangsregels en scorefuncties;
  `supabase/README.md` beschrijft installatie. Netwerkfouten mogen lokaal opslaan
  nooit blokkeren. Een oude toestemming voor alleen een totaalscore mag geen
  oefenlabels publiceren: behoud naam/identiteit, maar laat de gebruiker één keer
  zijn naam bevestigen met de nieuwe openbare melding. Geen extra keuze voor
  deelname of gebruikerslogin toevoegen.
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

Controleer geldige en ongeldige JSON-back-ups, migratie van versies 1/2/3 en
versie-4-export/import met sets, ranglijstkoppelingen, eigen onderdelen en
lichaamsgewicht. Controleer migratie van een oud bestand vlak onder 5 MiB en
een versie-3-bestand vlak onder 6 MiB naar de nieuwe limiet van 7 MiB.
Controleer herstel na herladen, maximaal zeven kopieën, vervanging van de dagkopie,
bescherming vóór import/herstel, corrupt current met geldige kopie en rollback
bij een opslagfout. Alleen de actuele toestand hoort in de handmatige export.

Controleer ranglijstdeelname zonder gebruikerslogin: alias plus totalen per oefening,
Squat/Squats samengevoegd, Bench press/apparaat gescheiden, eigen namen behouden,
koppeling corrigeren zonder geschiedenisverlies, filteren, eenmalige naamstart
met duidelijke openbare melding en geen publicatie vóór die start. Controleer
automatische score-updates, gedeelde gebruikersnamen in suggesties, vrije invoer
en alleen eigen scores kunnen wijzigen,
offline en netwerkfouten, verlopen anonieme sessies en geen sessie in JSON.
Controleer de vier pagina’s via navigatie, directe URL, herladen en browser
terug/vooruit. Statistieken, Ranglijst en Jouw gegevens mogen geen modal/backdrop
of dubbele navigatie tonen. Controleer compacte knoppen, actieve pagina en
bereikbare labels op mobiel. Controleer tijdens het typen, selecteren en wissen
van oefennamen dat de velden en bewaaractie niet opspringen, ook met het mobiele
toetsenbord en bij geen resultaten.
Controleer offline openen na eerste installatie, de updateknop en werking onder
een subdirectory. Een andere browser begint met een leeg logboek. Gebruik geen
echte gebruikersgegevens in tests of openbare voorbeelden.

# Fitness

Een klein Nederlands trainingslogboek voor je iPhone. Kies een trainingsschema,
voeg oefeningen toe en houd gewicht, sets en reps bij. Wijzigingen worden
automatisch op je eigen toestel opgeslagen. Bij de eerste start kies je één
openbare naam; daarmee doe je automatisch mee aan de ranglijsten per oefening.

Bij een nieuwe trainingsdag staan automatisch de oefeningen, gewichten, sets en
reps van de **laatste eerdere training van hetzelfde onderdeel** klaar. Ieder
onderdeel onthoudt zijn eigen training. Een aanpassing wordt vanzelf bewaard;
gebruik **Deze training bewaren** als je dezelfde waarden opnieuw gebruikt.
Een al opgeslagen dag houdt zijn eigen waarden en wordt niet overschreven door
een latere training.

## Je schema en voortgang

Bovenaan staan compacte knoppen voor **Statistieken**, **Ranglijst**,
**Geschiedenis** en **Instellingen**. Tik op **Fitness** om terug te gaan naar je
training. Training, Statistieken, Ranglijst en Jouw gegevens zijn gewone pagina’s;
je kunt de terugknop van je browser gebruiken. Geschiedenis en korte bewerkingen,
zoals een oefening toevoegen, openen als dialoog.

De pagina’s hebben elk een eigen link: [Training](https://backspin-dev.github.io/fitness-tracker/#/training),
[Statistieken](https://backspin-dev.github.io/fitness-tracker/#/statistieken),
[Ranglijst](https://backspin-dev.github.io/fitness-tracker/#/ranglijst) en
[Jouw gegevens](https://backspin-dev.github.io/fitness-tracker/#/gegevens).
Je trainingspagina toont je oefeningen en invoer; grafieken en scores staan op
hun eigen pagina.

Via **Schema aanpassen** kies je **Push / Pull / Legs**, **Full body** of
**Upper / Lower**. Je kunt ook eigen onderdelen toevoegen, namen aanpassen en
onderdelen verbergen of terugzetten. Bij een ander schema blijven de oefeningen
en eerdere trainingen van verborgen onderdelen bewaard. Ze blijven beschikbaar
in je geschiedenis en voortgang.

**Statistieken** opent je voortgang:

- **Oefeningen:** bekijk gewicht of reps per set per opgeslagen training en het
  totale aantal herhalingen per oefening binnen dat onderdeel. Het totaal is
  **sets × reps per set**, opgeteld over de opgeslagen trainingen. Drie sets van
  tien reps leveren dus dertig herhalingen op. Iedere opgeslagen trainingsdag
  telt één keer; opnieuw aanpassen vervangt die dag en telt niet dubbel.
  Klaargezette oefeningen tellen pas mee zodra je die training bewaart of
  aanpast. Een naamswijziging houdt de geschiedenis bij elkaar.
- **Gewicht:** voeg je lichaamsgewicht per datum toe en bekijk de grafiek.
  Per datum is er één meting; opnieuw bewaren vervangt die meting.
- **Trainingen:** bekijk aantallen per week en over de laatste 28 dagen, voor
  alle onderdelen of één onderdeel. Bij één onderdeel zie je ook de verschillen
  met de vorige opgeslagen training per oefening.

De telling gaat over **opgeslagen trainingen**, niet over afgevinkte of afgeronde
trainingen. Eén oefening heeft één gewicht, aantal sets en aantal reps per set
voor die trainingsdag. De app registreert geen verschillende waarden per losse set.

## Uitlegvideo's

Bij bekende oefeningen met een passende video staat **Uitlegvideo** onder de
sets en reps. Open dit om de YouTube-speler te laden. Onder de video staat
**Bron** met een directe link naar dezelfde video op YouTube. Dichtklappen of
naar een andere pagina gaan stopt de speler. Een oefening zonder gecontroleerde
match krijgt geen videoknop; eigen oefennamen blijven altijd mogelijk.

Alle 150 catalogusoefeningen hebben momenteel een referentie (147 unieke video's).
Titels, makers en uitvoeringsvarianten zijn gecontroleerd aan de hand van openbare
bronpagina's en videometadata; niet alle video's zijn volledig visueel bekeken.
De broncontrole staat in `video-sources.json`. De koppeling gebruikt de bekende
oefennaam en aliassen, geen gok op basis van gewicht of een ranglijstcorrectie.
Een machine, dumbbell en barbell blijven verschillende uitvoeringen.

Video's hebben internet nodig en worden niet in het logboek, back-ups of de
appcache opgeslagen. Voor openvouwen worden geen thumbnails, spelers of
YouTube-scripts geladen. De speler gebruikt YouTube's
[privacy-enhanced mode](https://support.google.com/youtube/answer/171780), zonder
autoplay. Na openen ontvangt YouTube een normaal webverzoek, waaronder IP-adres,
video-ID en app-origin; geen naam, trainingsdatum, lichaamsgewicht, kilo's, sets
of reps uit het logboek. YouTube kan advertenties tonen of een video later
verwijderen/blokkeren. De bronlink blijft ook beschikbaar wanneer insluiten
niet werkt. Het logboek zelf blijft offline bruikbaar.

## Openen op je iPhone

1. Open [Fitness](https://backspin-dev.github.io/fitness-tracker/) in Safari.
2. Kies **Deel → Zet op beginscherm**. Zet **Open als webapp** aan als die optie
   verschijnt en tik op **Voeg toe**.
3. Open **Fitness** vanaf het nieuwe icoontje en voer daar je oefeningen in.
4. Laat de app de eerste keer met internetverbinding laden. Daarna is het
   logboek ook offline beschikbaar wanneer de browser de appbestanden heeft bewaard.

Gebruik steeds hetzelfde beginschermicoontje. Voeg de app bij voorkeur toe
voordat je gegevens invoert: Safari en een geïnstalleerde webapp kunnen een
verschillende opslagcontext gebruiken. Een update van de app biedt de app zelf
aan; je gegevens worden daarbij behouden.

## Automatische lokale kopieën en toestelwissel

De app bewaart automatisch **maximaal zeven lokale herstelkopieën** in dezelfde
browseropslag als je logboek. Je hoeft daarvoor geen bestand te kiezen of terug
te zoeken. Per dag blijft de laatste gewijzigde versie bewaard. Alleen een andere
datum of tab openen maakt geen nieuwe kopie. Vóór importeren of een kopie
terugzetten bewaart de app ook de vervangen toestand; deze extra kopieën tellen
mee binnen het maximum van zeven. Je vindt de kopieën bij **Instellingen** en
kunt daar een eerdere toestand terugzetten.

Er verschijnt geen periodieke herinnering meer om een JSON-bestand op te slaan.
Een handmatige **JSON-export** blijft beschikbaar voor een toestelwissel of een
kopie buiten deze app. Exporteer die vóór de wissel en importeer hetzelfde bestand
op het nieuwe toestel. Het bestand bevat het actuele logboek, je onderdelen en
lichaamsgewicht; het bevat niet alle lokale herstelkopieën of je deelname aan de
ranglijst. Bij import blijft de vorige huidige toestand als lokale herstelkopie
beschikbaar.

Oudere back-ups en bestaande lokale gegevens worden automatisch naar
**schemaversie 4** omgezet. Oefeningen uit versies 1 en 2 krijgen **één set**,
zodat eerdere reptotalen gelijk blijven. De koppeling met een ranglijstoefening
wordt automatisch ingevuld; je eigen oefennamen blijven behouden. IDs, oefeningen,
gewichten, reps, trainingsdatums, eigen onderdelen en lichaamsmetingen blijven
behouden. Back-ups mogen maximaal **7 MiB** groot zijn. De extra ruimte houdt oudere
bestanden bruikbaar wanneer sets of ranglijstkoppelingen worden toegevoegd.

De herstelkopieën staan op hetzelfde toestel. Websitegegevens wissen,
verwijderen van de app, een privévenster of opschoning door iOS kan zowel het
logboek als die kopieën verwijderen. Permanente bewaring kan een webapp niet
garanderen. Een geëxporteerde JSON is leesbaar: bewaar het bestand privé en upload
het nooit naar deze repository. Alleen tekst en getallen worden opgeslagen;
het opslaggebruik hangt af van je geschiedenis en de opslag van iOS.

## Je gegevens en de ranglijst

- Je schema, oefeningen, gewichten, sets, reps, trainingen en lichaamsgewicht
  staan in **IndexedDB** op het toestel en in de browser waarin je ze invoert.
  Er is geen online trainingslogboek, synchronisatie of online back-up.
- De appcode en de lege website zijn openbaar. Iemand die dezelfde link op een
  ander toestel opent, krijgt zijn eigen lege logboek.
- Iemand met toegang tot je ontgrendelde telefoon kan je logboek openen.
  De app heeft geen extra wachtwoord of eigen versleuteling.
- De app heeft geen eigen analytics, advertenties of externe lettertypen.
  GitHub levert de openbare appbestanden en ontvangt normale webverzoeken;
  je trainingsinvoer zit daar niet in. Alleen een geopende uitlegvideo maakt
  daarnaast verbinding met YouTube, zoals hierboven beschreven.

De gezamenlijke ranglijst gebruikt **Supabase** en geldt **per oefening**. Kies
een oefening in de ranglijst om de totale herhalingen van deelnemers te zien.
Het ranglijstscherm toont meteen de oefenkeuze en scores. Je openbare naam wijzig
je via **Instellingen → Naam wijzigen**.
Bij de eerste start vul je één openbare naam in. Het startscherm vermeldt dat
deze naam, je ranglijstoefeningen en totale reps per oefening openbaar worden.
Daarna tellen je opgeslagen trainingen automatisch mee; je hoeft niet telkens
iets te delen of aan te melden. Een bestaande gebruiker bevestigt zijn naam één
keer voor deze werkwijze. Offline kun je gewoon trainen; de scores worden
verstuurd zodra de app weer verbinding heeft.

Bij het invoeren van een oefening kun je gewoon je eigen naam typen. Tijdens
het typen zie je een korte lijst met passende oefeningen binnen een vast
begrensd vlak. De invoervelden en bewaaractie blijven op hun plek terwijl de
resultaten veranderen. Tik op een suggestie
of gebruik je eigen tekst; een keuze uit de lijst is nooit verplicht. De
catalogus bevat **150 bestaande oefeningen** en herkenbare varianten,
gecontroleerd aan de hand van de [ACE-oefenbibliotheek](https://www.acefitness.org/resources/everyone/exercise-library/)
en [NASM-oefenbibliotheek](https://www.nasm.org/resource-center/exercise-library).
De app gebruikt alleen namen en aliassen; er worden geen instructies of
afbeeldingen van deze bronnen geladen. Bekende catalogusoefeningen staan vooraan. Andere gedeelde namen herken je aan
**Door gebruikers**; die zijn door gebruikers bedacht en worden niet als
gecontroleerde catalogusoefeningen gepresenteerd. Suggesties helpen om dezelfde
oefening herkenbaar te houden. Bekende varianten, zoals
**Squat** en **Squats**, horen bij dezelfde ranglijstoefening. Verschillende
uitvoeringen, zoals **Bench press** en **Bench press machine**, blijven apart.
Onbekende eigen oefeningen krijgen een eigen ranglijst; hoofdletters,
witruimte en leestekens maken daarbij geen afzonderlijke ranglijst. De app raadt
niet zelf welke andere namen of uitvoeringen hetzelfde zijn. Een ingeklapte
toelichting toont de koppeling voor de ranglijst; zo nodig kun je je eigen
oefening aan een bekende oefening koppelen zonder je eigen naam te veranderen.
Je oefeningen en geschiedenis in het lokale logboek blijven aan hun eigen IDs
gekoppeld.

Alleen je openbare naam en een totaal per ranglijstoefening worden gepubliceerd:
de herkenbare oefennaam plus het aantal herhalingen (**sets × reps**, over
opgeslagen trainingen tot en met vandaag). Dezelfde ranglijstoefening telt
over je verschillende onderdelen heen bij elkaar op. De technische dienst
bewaart daarbij een anonieme identiteit en de bijwerkdatum. Bij een eigen
oefening wordt de genormaliseerde naam daarvan dus ook openbaar. Trainingsdatums,
gewichten, afzonderlijke sets/reps, lichaamsmetingen en het volledige logboek
worden niet verstuurd.

Je hoeft geen e-mail, wachtwoord of gebruikersaccount te maken. De app beheert
achter de schermen een anonieme sessie om alleen je eigen scores te wijzigen.
Die sessie blijft in de browser op dat toestel en zit **niet in de JSON-back-up**.
Een toestelwissel of het wissen/verlopen van die sessie kan daarom een nieuwe
deelname opleveren; de app belooft geen herstel van de oude ranglijstidentiteit.
Namen zijn niet uniek en vormen geen bewijs van identiteit. Scores komen uit
zelf ingevoerde gegevens; de ranglijst is bedoeld voor plezier en verifieert geen
sportprestaties. Offline blijven je trainingen werken; score-updates vereisen
internet.

## GitHub Pages en ranglijstconfiguratie

Deze repository bevat de volledige website, zonder buildstap of afhankelijkheden.
Voor de gratis publicatie:

1. Open **Settings → Pages** in deze repository.
2. Kies onder **Build and deployment** de bron **Deploy from a branch**.
3. Kies branch **main** en map **/ (root)** en klik **Save**.
4. Na de publicatie is de app bereikbaar via het adres hierboven. Een eigen
   domeinnaam is niet nodig.

Voor de ranglijst configureert alleen de ontwikkelaar het Supabase-project en
de databasebeveiliging met `supabase/schema.sql`; zie `supabase/README.md` voor
de installatie. `leaderboard-config.js` bevat de publieke project-URL en
publishable/anon-sleutel. Een secret- of service-role-sleutel hoort nooit in deze
app of repository. De backendtoegang is uitsluitend voor openbare aliassen, ranglijstoefeningen en
scores; de lokale back-ups blijven lokaal. Zonder configuratie blijft het
trainingslogboek werken en is de gezamenlijke ranglijst niet aangesloten.

Trainingsgegevens horen niet in GitHub. Pas voor wijzigingen alleen de code aan.
Bij wijzigingen aan de appbestanden moet ook `CACHE_VERSION` in `sw.js` omhoog,
zodat geïnstalleerde exemplaren de nieuwe versie kunnen downloaden.

## Lokaal ontwikkelen

Start vanuit deze map een eenvoudige server:

```sh
python3 -m http.server 8000
```

Open daarna `http://localhost:8000/`. Offlinefunctionaliteit vereist HTTPS of
localhost; rechtstreeks openen via `file://` werkt niet als geïnstalleerde app.
De productieversie op GitHub Pages gebruikt HTTPS.

De interface staat in `index.html`, `styles.css` en `app.js`. `navigation.js`
regelt de vier paginaroutes via de URL-fragmenten `#/training`, `#/statistieken`,
`#/ranglijst` en `#/gegevens`, inclusief directe links en browsergeschiedenis.
`exercise-names-ui.js` bedient de zichtbare suggesties zonder verschuivende
formulierindeling. `groups-ui.js`
bedient de schema's; `progress-ui.js` bedient de voortgang en lichaamsgewicht.
`stats.js` berekent statistieken en tekent grafieken met `stats.css`.
Het gegevensmodel, migratie, opslag en back-upvalidatie staan in `data.js`.
`exercise-catalog.js` beheert ranglijstoefeningen, bekende naamvarianten en
suggesties. Persoonlijke namen en geschiedenis blijven onafhankelijk daarvan.
`recovery.js` beheert de begrensde lokale kopieën; `recovery-ui.js` bedient het
terugzetten. `leaderboard.js` verzorgt uitsluitend de scoreverbinding;
`leaderboard-ui.js` bedient het ranglijstscherm en `leaderboard-config.js` bevat
de publieke configuratie. `backup-reminder.js`
bevat nog helpers voor gegevensdetectie en oude herinneringsmetadata; de
periodieke herinnering wordt niet meer aangeboden. `sw.js` bewaart uitsluitend
de openbare appbestanden voor offline gebruik, in caches die bij deze app-scope horen.
Zie [AGENTS.md](AGENTS.md) voor de ontwikkelafspraken en controles.

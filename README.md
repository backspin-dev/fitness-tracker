# Fitness

Een klein Nederlands trainingslogboek voor je iPhone. Kies een trainingsschema,
voeg oefeningen toe en houd gewicht, sets en reps per set bij. Wijzigingen worden
automatisch op je eigen toestel opgeslagen.

Bij een nieuwe trainingsdag staan automatisch de oefeningen, gewichten, sets en
reps van de **laatste eerdere training van hetzelfde onderdeel** klaar. Ieder
onderdeel onthoudt zijn eigen training. Een aanpassing wordt vanzelf bewaard;
gebruik **Deze training bewaren** als je dezelfde waarden opnieuw gebruikt.
Een al opgeslagen dag houdt zijn eigen waarden en wordt niet overschreven door
een latere training.

## Je schema en voortgang

Via **Schema aanpassen** kies je **Push / Pull / Legs**, **Full body** of
**Upper / Lower**. Je kunt ook eigen onderdelen toevoegen, namen aanpassen en
onderdelen verbergen of terugzetten. Bij een ander schema blijven de oefeningen
en eerdere trainingen van verborgen onderdelen bewaard. Ze blijven beschikbaar
in je geschiedenis en voortgang.

Het grafiekicoon bovenaan opent **Jouw voortgang**:

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
**schemaversie 3** omgezet. Oude oefeningen krijgen **één set**, zodat eerdere
reptotalen gelijk blijven. IDs, oefeningen, gewichten, reps, trainingsdatums,
eigen onderdelen en lichaamsmetingen blijven behouden. Back-ups mogen maximaal
**6 MiB** groot zijn; de extra ruimte zorgt dat oude bestanden tot 5 MiB na het
toevoegen van sets bruikbaar blijven.

De herstelkopieën staan op hetzelfde toestel. Websitegegevens wissen,
verwijderen van de app, een privévenster of opschoning door iOS kan zowel het
logboek als die kopieën verwijderen. Permanente bewaring kan een webapp niet
garanderen. Een geëxporteerde JSON is leesbaar: bewaar het bestand privé en upload
het nooit naar deze repository. Alleen tekst en getallen worden opgeslagen;
het opslaggebruik hangt af van je geschiedenis en de opslag van iOS.

## Je gegevens en de optionele ranglijst

- Je schema, oefeningen, gewichten, sets, reps, trainingen en lichaamsgewicht
  staan in **IndexedDB** op het toestel en in de browser waarin je ze invoert.
  Er is geen online trainingslogboek, synchronisatie of online back-up.
- De appcode en de lege website zijn openbaar. Iemand die dezelfde link op een
  ander toestel opent, krijgt zijn eigen lege logboek.
- Iemand met toegang tot je ontgrendelde telefoon kan je logboek openen.
  De app heeft geen extra wachtwoord of eigen versleuteling.
- Er zijn geen trackers, analytics, advertenties of externe lettertypen.
  GitHub levert de openbare appbestanden en ontvangt normale webverzoeken;
  je trainingsinvoer zit daar niet in.

De gezamenlijke ranglijst gebruikt **Supabase**. Deelname is optioneel: kies een
openbare naam en tik expliciet op **Meedoen**. Alleen die naam en je totale
repscore (**sets × reps**, over alle opgeslagen trainingen tot en met vandaag)
worden gepubliceerd. De technische dienst bewaart daarbij een anonieme
identiteit en de bijwerkdatum van de score. Oefennamen, trainingsdatums,
gewichten, afzonderlijke sets/reps en lichaamsmetingen worden niet verstuurd.

Je hoeft geen e-mail, wachtwoord of gebruikersaccount te maken. De app beheert
achter de schermen een anonieme sessie om alleen je eigen score te wijzigen.
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
app of repository. De backendtoegang is uitsluitend voor openbare aliassen en
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

De interface staat in `index.html`, `styles.css` en `app.js`. `groups-ui.js`
bedient de schema's; `progress-ui.js` bedient de voortgang en lichaamsgewicht.
`stats.js` berekent statistieken en tekent grafieken met `stats.css`.
Het gegevensmodel, migratie, opslag en back-upvalidatie staan in `data.js`.
`recovery.js` beheert de begrensde lokale kopieën; `recovery-ui.js` bedient het
terugzetten. `leaderboard.js` verzorgt uitsluitend de optionele scoreverbinding;
`leaderboard-ui.js` bedient het ranglijstscherm en `leaderboard-config.js` bevat
de publieke configuratie. `backup-reminder.js`
bevat nog helpers voor gegevensdetectie en oude herinneringsmetadata; de
periodieke herinnering wordt niet meer aangeboden. `sw.js` bewaart uitsluitend
de openbare appbestanden voor offline gebruik, in caches die bij deze app-scope horen.
Zie [AGENTS.md](AGENTS.md) voor de ontwikkelafspraken en controles.

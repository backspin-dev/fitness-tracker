# Fitness

Een klein Nederlands trainingslogboek voor je iPhone. Kies een trainingsschema,
voeg oefeningen toe en houd je gewicht en herhalingen bij. Wijzigingen worden
automatisch op je eigen toestel opgeslagen.

Bij een nieuwe trainingsdag staan automatisch de oefeningen, gewichten en reps
van de **laatste eerdere training van hetzelfde onderdeel** klaar. Ieder
onderdeel onthoudt zijn eigen training. Een aanpassing wordt vanzelf
bewaard; gebruik **Deze training bewaren** als je dezelfde waarden opnieuw
gebruikt. Een al opgeslagen dag houdt zijn eigen waarden en wordt niet
overschreven door een latere training.

## Je schema en voortgang

Via **Schema aanpassen** kies je **Push / Pull / Legs**, **Full body** of
**Upper / Lower**. Je kunt ook eigen onderdelen toevoegen, namen aanpassen en
onderdelen verbergen of terugzetten. Bij een ander schema blijven de oefeningen
en eerdere trainingen van verborgen onderdelen bewaard. Ze blijven beschikbaar
in je geschiedenis en voortgang.

Het grafiekicoon bovenaan opent **Jouw voortgang**:

- **Oefeningen:** bekijk het gewicht of aantal reps per opgeslagen training en
  het totaal aantal ingevoerde reps per oefening binnen dat onderdeel. Iedere
  opgeslagen trainingsdag telt één keer; opnieuw aanpassen telt niet dubbel.
  Klaargezette oefeningen tellen pas mee zodra je die training bewaart of
  aanpast. Een naamswijziging houdt de geschiedenis bij elkaar.
- **Gewicht:** voeg je lichaamsgewicht per datum toe en bekijk de grafiek.
  Per datum is er één meting; opnieuw bewaren vervangt die meting.
- **Trainingen:** bekijk aantallen per week en over de laatste 28 dagen, voor
  alle onderdelen of één onderdeel. Bij één onderdeel zie je ook de verschillen
  met de vorige opgeslagen training per oefening.

De telling gaat over **opgeslagen trainingen**, niet over afgevinkte of afgeronde
trainingen. Een wijziging in een training bewaart die dag automatisch. De app
berekent geen trainingsvolume: er worden geen afzonderlijke sets bijgehouden.

## Openen op je iPhone

1. Open [Fitness](https://backspin-dev.github.io/fitness-tracker/) in Safari.
2. Kies **Deel → Zet op beginscherm**. Zet **Open als webapp** aan als die optie
   verschijnt en tik op **Voeg toe**.
3. Open **Fitness** vanaf het nieuwe icoontje en voer daar je oefeningen in.
4. Laat de app de eerste keer met internetverbinding laden. Daarna is de tool
   ook offline beschikbaar wanneer de browser de appbestanden heeft bewaard.

Gebruik steeds hetzelfde beginschermicoontje. Voeg de app bij voorkeur toe
voordat je gegevens invoert: Safari en een geïnstalleerde webapp kunnen een
verschillende opslagcontext gebruiken. Een update van de app biedt de app zelf
aan; je gegevens worden daarbij behouden.

## Je gegevens en privacy

- Je schema, oefeningen, gewichten, herhalingen, trainingen en lichaamsgewicht
  staan in **IndexedDB** op het toestel en in de browser waarin je ze invoert.
  De app verstuurt deze gegevens niet naar GitHub of een andere server.
- De appcode en de lege website zijn openbaar. Iemand die dezelfde link op een
  ander toestel opent, krijgt zijn eigen lege logboek.
- Iemand met toegang tot je ontgrendelde telefoon kan je logboek wel openen.
  De app heeft geen extra wachtwoord of eigen versleuteling.
- Er zijn geen trackers, analytics, advertenties, accounts of externe
  lettertypen. GitHub levert de openbare appbestanden en ontvangt daardoor de
  normale webverzoeken; je trainingsinvoer zit daar niet in.
- Er is **geen automatische synchronisatie of online back-up**. Op een nieuwe
  telefoon zet je zelf een geëxporteerde back-up terug.

Met de back-upfunctie kun je je logboek als JSON-bestand bewaren, bijvoorbeeld
in je eigen iCloud Drive, en later terugzetten. De back-up bevat ook je eigen
onderdelen, verborgen onderdelen en lichaamsgewicht. Oudere back-ups met alleen
Push / Pull / Legs blijven bruikbaar; de app zet ze bij het importeren om naar
het huidige gegevensmodel. Bestaande lokale gegevens worden eveneens automatisch
omgezet. Dit bestand bevat jouw gegevens leesbaar: bewaar het op een plek waar
alleen jij toegang toe hebt en upload het niet naar deze repository. Maak geregeld
een nieuwe back-up.

Zodra je trainingen of lichaamsgewicht hebt opgeslagen, start een lokale
herinnering. Na **14 dagen**
verschijnt bij het openen of hervatten van de app een melding met **Back-up
opslaan** en **Over 3 dagen**. Er komt geen pushbericht wanneer de app gesloten
is. Na een export bevestig je zelf met **Ja, bewaard** dat het bestand veilig
staat; pas dan beginnen de volgende 14 dagen. Delen of downloaden annuleren
telt niet als een bewaarde back-up. De app maakt geen automatische externe
kopie. De herinneringsdatum staat apart op dit toestel en zit niet in exports.

Websitegegevens wissen, verwijderen van de app, een privévenster of opschoning
door iOS kan lokale gegevens laten verdwijnen. Permanente bewaring kan een
webapp niet garanderen. Alleen tekst en getallen worden opgeslagen; het werkelijke
opslaggebruik hangt af van je geschiedenis en de opslag van iOS.

## GitHub Pages

Deze repository bevat de volledige website, zonder buildstap of afhankelijkheden.
Voor de gratis publicatie:

1. Open **Settings → Pages** in deze repository.
2. Kies onder **Build and deployment** de bron **Deploy from a branch**.
3. Kies branch **main** en map **/ (root)** en klik **Save**.
4. Na de publicatie is de app bereikbaar via het adres hierboven. Een eigen
   domeinnaam is niet nodig.

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
Het gegevensmodel, migratie, opslag en back-upvalidatie staan in `data.js`;
`backup-reminder.js` regelt de lokale herinneringsdatum. `sw.js` bewaart uitsluitend
de openbare appbestanden voor offline gebruik, in caches die bij deze app-scope horen.
Zie [AGENTS.md](AGENTS.md) voor de ontwikkelafspraken en controles.

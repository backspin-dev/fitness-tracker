# Fitness

Een klein Nederlands trainingslogboek voor je iPhone. Kies Push, Pull of Legs,
voeg oefeningen toe en houd je gewicht en herhalingen bij. Wijzigingen worden
automatisch op je eigen toestel opgeslagen.

Bij een nieuwe trainingsdag staan automatisch de oefeningen, gewichten en reps
van de **laatste eerdere training van hetzelfde onderdeel** klaar. Push, Pull
en Legs onthouden ieder hun eigen training. Een aanpassing wordt vanzelf
bewaard; gebruik **Deze training bewaren** als je dezelfde waarden opnieuw
gebruikt. Een al opgeslagen dag houdt zijn eigen waarden en wordt niet
overschreven door een latere training.

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

- Je oefeningen, gewichten, herhalingen en trainingen staan in **IndexedDB** op
  het toestel en in de browser waarin je ze invoert. De app verstuurt deze
  gegevens niet naar GitHub of een andere server.
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
in je eigen iCloud Drive, en later terugzetten. Dit bestand bevat jouw gegevens
leesbaar: bewaar het op een plek waar alleen jij toegang toe hebt en upload het
niet naar deze repository. Maak geregeld een nieuwe back-up.

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

De interface staat in `index.html`, `styles.css` en `app.js`; het gegevensmodel
en de opslag staan in `data.js`. `sw.js` bewaart uitsluitend de openbare
appbestanden voor offline gebruik, in caches die bij deze app-scope horen.
Zie [AGENTS.md](AGENTS.md) voor de ontwikkelafspraken en controles.

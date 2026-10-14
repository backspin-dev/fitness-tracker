# Ranglijsten per oefening

Trainingen, wegingen en herstelkopieën blijven lokaal. Iedereen geeft bij het
eerste gebruik één naam op en ziet daarbij dat de naam, ranglijstoefeningen,
de som van de reps uit alle losse sets en het zwaarste gebruikte gewicht per
oefening openbaar zijn. Daarna worden de oefenscores automatisch bijgewerkt.
Individuele trainingsdatums, de overige gewichten, sets, reps per training,
lichaamsgewicht en het volledige logboek worden nooit verstuurd.

## Eenmalige inrichting

1. Maak een Supabase-project en zet bij Authentication → Sign In / Providers
   **Anonymous Sign-Ins** aan. Deelnemers vullen alleen een naam in.
2. Voer `schema.sql` uit in de SQL Editor. Het bestand kan opnieuw worden
   uitgevoerd. Houd `fitness_private` buiten de **Exposed schemas** van de Data
   API; `public` moet beschikbaar blijven.
3. Vul project-URL en **publishable** sleutel in `leaderboard-config.js` in.
   Een legacy `anon` sleutel werkt ook. Gebruik nooit `secret` of `service_role`.
4. Voeg uitsluitend de exacte project-origin toe aan `connect-src` in de CSP van
   `index.html`. Verhoog de offline cacheversie voor gewijzigde bestanden.
5. Controleer met twee testdeelnemers afzonderlijke scores bij dezelfde naam,
   naam wijzigen zonder nieuwe identiteit, oefenfilter, aliasnormalisatie,
   de verplichte naamstart, naam wijzigen via Instellingen en afzonderlijk
   sorteren op **Meeste reps** en **Zwaarste gewicht**. Controleer dat REST `select=user_id` faalt,
   anoniem schrijven zonder user-JWT faalt en direct schrijven naar
   `fitness_exercise_scores` onmogelijk is. Verberg alleen zelf aangemaakte
   testdeelnemers na controle via de eigen `fitness_leave_exercise_scores` RPC;
   er worden geen rijen permanent verwijderd.

Een bestaand ingericht project werkt bij met `weight-ranking.sql`, vóór de
nieuwe client wordt gepubliceerd. Die migratie kan opnieuw worden uitgevoerd
en verandert geen trainingslogboeken, actieve deelnemers of beheeruitsluitingen.
Oude scores krijgen geen fictief 0kg-record: `max_weight` blijft `NULL` totdat
de bijgewerkte client na de nieuwe openbaarheidsmelding een gewichtrecord deelt.

## Oefeningen en privacy

De catalogus in `exercise-catalog.js` bevat gecontroleerde echte oefeningen met vaste
sleutels. Alleen expliciete
aliassen worden samengevoegd: Squat en Squats delen één ranglijst. Bench press,
Bench press machine en Dumbbell bench press blijven verschillende oefeningen.
Eigen namen krijgen een sleutel uit NFKC-normalisatie, kleine letters en
samengevoegde scheidingstekens. Symbolen blijven bewaard wanneer een naam alleen
uit symbolen bestaat. Labels zijn deterministisch; normalisatie mag de sleutel
niet veranderen via hoofdletters die uit meerdere tekens bestaan.

De server bewaart dezelfde catalogus met aliassen in het niet-blootgestelde
schema. Bekende sleutels krijgen uitsluitend het cataloguslabel. Een eigen
sleutel moet bij de genormaliseerde naam horen; bekende aliassen worden ook
serverzijdig naar de vaste sleutel omgezet. Daardoor kan een oudere client met
`custom:squats` geen tweede Squat-ranglijst maken. Bij dubbelen na normalisatie
worden reps opgeteld en wordt het hoogste gedeelde gewicht gebruikt. De server
vervangt alle actieve oefenscores van uitsluitend de JWT-
eigenaar atomair; weggelaten oefeningen worden verborgen. De client bepaalt de
laatste opgeslagen naam/indeling per lokale groep en oefen-ID en gebruikt die
voor alle eerdere reps en gewichtrecords van diezelfde oefening.

De nieuwe tabel `fitness_exercise_scores` heeft RLS en alleen openbare SELECT-
kolomrechten voor oefensleutel, oefenlabel, alias, totaal reps, zwaarste gewicht
en bijwerktijd.
Gebruikers-IDs en de actieve vlag zijn niet leesbaar. Rechtstreeks schrijven is
niet toegestaan; de RPC controleert `auth.uid()` en schrijft uitsluitend eigen
rijen. Publieke RPC-wrappers zijn security invoker. De beperkte security definer-
functies staan in `fitness_private`, met een lege `search_path` en expliciete
rechten. De overzichtsview `fitness_available_exercises` is security invoker en
behoudt dus RLS en kolomrechten.

Het eerste naamvenster is verplicht en heeft één veld en **Starten**. De
openbaarheidsmelding staat er direct bij. De naam wordt eerst lokaal bewaard;
zonder verbinding kan de gebruiker daarna gewoon trainen. De scores worden
later automatisch verstuurd. Een opslagfout houdt het naamvenster open. Het
venster verschijnt niet tijdens laden, in een alleen-lezen tabblad of bij een
opslagfout die het logboek verhindert te laden. **Naam wijzigen** staat in
Instellingen en gebruikt hetzelfde veld, dan met een annuleermogelijkheid.

Ook een oud profiel voor uitsluitend reps bevestigt eenmalig de naam in dit
venster, met de nieuwe melding over het openbare gewichtrecord. Naam en anonieme
sessie blijven behouden; pas na **Starten** wordt `scoreMode: 'exercise-v2'`
bewaard. Profielen die al een actieve naam voor deze scoremodus hebben, hoeven
dit niet te herhalen. De normale app
biedt geen keuze om niet aan de ranglijst deel te nemen. Publiceren van
per-oefeningscores verbergt de eigen oude globale score. De oude tabel en RPC
blijven bestaan voor reeds gecachete appversies.

## REST-protocol

Er wordt alleen native `fetch` gebruikt, zonder SDK:

- Anonieme sessie: `POST /auth/v1/signup` met `{ "data": {} }`.
- Vernieuwen: `POST /auth/v1/token?grant_type=refresh_token`.
- Publieke oefenlijst: `GET /rest/v1/fitness_available_exercises` met alleen
  `exercise_key,exercise_name`, zonder zoektekst of user-JWT.
- Oefenranglijst: `GET /rest/v1/fitness_exercise_scores` met alleen openbare
  kolommen, een gequote en URL-gecodeerd `exercise_key=in.("…")` filter,
  `order=total_reps.desc,updated_at.asc` voor reps of
  `max_weight=not.is.null&order=max_weight.desc.nullslast,updated_at.asc` voor
  gewicht, steeds met `limit=50`.
- Bijwerken: `POST /rest/v1/rpc/fitness_submit_exercise_scores` met
  `p_display_name` en `p_scores`, een array van uitsluitend
  `{exercise_key,exercise_name,total_reps,max_weight}`.
- Stoppen: `POST /rest/v1/rpc/fitness_leave_exercise_scores` zonder parameters.

De `apikey`-header bevat de publieke sleutel. Bij schrijven bevat
`Authorization` de JWT van de eigen deelnemer. De openbare oefenlijst mag ook
suggesties in het vrije oefennaamveld aanvullen; de app verstuurt daarvoor geen
getypte namen of zoekopdrachten.

`max_weight` is een JSON-getal tussen 0 en 2.000 kg; decimalen blijven exact
bewaard zonder afronding. De waarde is één record per oefening, geen afzonderlijke
set of trainingsdatum. Een expliciete 0 is geldig en vervangt een eerder record
wanneer het lokale logboek wordt gecorrigeerd. Een ontbrekend veld van een oudere
client behoudt het bestaande gewichtrecord of `NULL`; `null`, tekst, negatieve
waarden en waarden boven 2.000 worden geweigerd. Ook lagere geldige nieuwe
records vervangen de vorige waarde: het is de actuele samenvatting van het
lokale logboek, geen serverarchief van verwijderde trainingen.

Die aanvulling bevat maximaal 1.000 openbare oefennamen, alfabetisch opgehaald
en daarna lokaal gefilterd. Het is een begrensde momentopname; bij een zeer grote
verzameling worden niet alle namen geladen. Eigen oefeningen die uitsluitend
lokaal zijn ingevoerd vóór het bewaren van de verplichte naam, worden nog niet
gedeeld. Daarna kunnen de gepubliceerde eigen oefennamen ook bij andere gebruikers als **Door gebruikers**
verschijnen. Dit zijn vrije gebruikersnamen voor oefeningen, geen gecontroleerde
toevoegingen aan de vaste catalogus. Als de laatste actieve deelnemer stopt met
delen, verdwijnt die eigen naam uit de openbare oefenlijst. Een al opgehaalde
momentopname kan op een ander toestel nog tot de volgende verversing zichtbaar
blijven.

De legacy- en test-RPC `fitness_leave_exercise_scores` verbergt de eigen scores
in zowel de oude globale tabel als de nieuwe oefentabel met `active = false`.
Deze API blijft bruikbaar voor oude gecachete clients en het opruimen van eigen
testprofielen; de huidige gebruikersinterface heeft geen stopknop. De oude
clientmethode bewaart het verbergen eerst lokaal en probeert een mislukt verzoek
later opnieuw, zonder nieuwe scores te publiceren. Opnieuw de naam bewaren kan
dezelfde behouden identiteit weer activeren.

De privésessie staat onder een aparte lokale sleutel en komt nooit in een JSON-
trainingsback-up of Git. Namen hoeven niet uniek te zijn en bewijzen geen
identiteit. Een naamwijziging op hetzelfde toestel behoudt de deelnemer. Wissen
van websitegegevens, een verlopen/verwijderde anonieme sessie of een ander toestel
kan de identiteit niet via de naam herstellen. Trainingsback-ups herstellen wel
trainingen; de naam opnieuw opgeven maakt dan een nieuwe deelnemer. Een ongeldige sessie
wordt nooit stilzwijgend vervangen.

Na het bewaren van de naam en lokaal opslaan wacht de app drie seconden en verstuurt alle actuele
samengevoegde oefenscores. Een canonieke JSON-vingerafdruk voorkomt herhaalde
verzoeken als alias en scores gelijk zijn. Netwerkfouten blokkeren lokaal opslaan
niet. Opnieuw proberen gebeurt bij openen, terugkeren naar de app, terugkeer van
verbinding of een volgende wijziging.

Het blijft een speelse ranglijst met zelf ingevulde scores. Materiaal, uitvoering
en lichaamsgewicht maken gewichtrecords niet onderling verifieerbaar; scores
kunnen worden gemanipuleerd. De ingebouwde
Supabase-aanmeldlimiet blijft aan. Een grotere publieke uitrol vraagt aanvullende
misbruikbescherming. Als CAPTCHA in Supabase wordt aangezet, moet ook een
CAPTCHA-token aan de aanmeldflow worden toegevoegd; deze versie laadt geen
externe CAPTCHA.

Bronnen: [anonieme deelnemers](https://supabase.com/docs/guides/auth/auth-anonymous),
[publieke API-sleutels](https://supabase.com/docs/guides/getting-started/api-keys),
[RLS en kolomrechten](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Auth REST-specificatie](https://github.com/supabase/auth/blob/master/openapi.yaml),
[officiële anonieme REST-aanroep](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts),
[gequote REST-filters](https://docs.postgrest.org/en/stable/references/api/tables_views.html).

## Catalogus bijwerken

Behoud bestaande sleutels. Na een wijziging van `exercise-catalog.js` regenereert
`node supabase/update-catalog.mjs` uitsluitend het catalogusblok in de SQL.
Voer daarna de SQL opnieuw uit. `node --test tests/backend-catalog.test.mjs`
controleert dat server en client exact dezelfde sleutels, labels en aliassen
hebben en geen alias verschillende oefeningen verbindt. Bij een uitbreiding
worden voorheen vrije namen die nu bekend zijn bij de volgende appopening/sync
naar hun canonieke oefenranglijst verplaatst; het lokale logboek blijft intact.

## Beheeruitsluiting

`moderation.sql` voegt een private RLS-tabel en schrijftoetsen toe voor beide
ranglijsttabellen. Een eigenaar kan daarin het bestaande anonieme UUID van een
deelnemer blokkeren en diens scores op `active=false` zetten. Die scores en
bijbehorende oefensuggesties verdwijnen voor publieke clients; beheer kan de
uitsluiting herstellen. Het lokale logboek op een ander toestel wordt niet
aangeraakt.

Triggers verhinderen opnieuw zichtbaar maken via RPC, oude clients of directe
REST-writes. PT403 meldt veilig dat deelname geblokkeerd is en vervangt geen
sessie of identiteit. Zet echte deelnemersnamen, UUIDs of beheerqueries nooit
in deze openbare repository. Een volledig nieuwe anonieme identiteit kan
zonder gebruikerslogin niet aan dezelfde persoon gekoppeld worden.

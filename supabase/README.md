# Online ranglijst

De trainingen, wegingen en herstelkopieën blijven lokaal. Alleen wie op **Meedoen**
tikt deelt een openbare alias en zijn actuele totaal: sets × reps van alle
opgeslagen trainingen tot en met vandaag. Het totaal is door de gebruiker zelf
opgegeven, geen gecontroleerde sportprestatie.

## Eenmalige inrichting

1. Maak een Supabase-project. Zet bij Authentication → Sign In / Providers
   **Anonymous Sign-Ins** aan. Er is geen e-mail of wachtwoord voor deelnemers.
2. Voer `schema.sql` uit in de SQL Editor. Houd `fitness_private` buiten de
   **Exposed schemas** van de Data API. `public` moet beschikbaar blijven.
3. Vul de project-URL en de **publishable** sleutel in `leaderboard-config.js` in.
   Een legacy `anon` sleutel werkt ook. Gebruik nooit `secret` of `service_role`.
4. Voeg alleen de exacte project-origin toe aan `connect-src` in de CSP van
   `index.html`. Verhoog de offline cacheversie voor de nieuwe bestanden.
5. Controleer met twee deelnemers dat dezelfde alias twee onafhankelijke regels
   oplevert, een naamwijziging dezelfde regel wijzigt en de ene deelnemer geen
   score van de ander kan wijzigen. Controleer dat REST `select=user_id` faalt,
   anoniem schrijven zonder user-JWT faalt en de openbare drie scorekolommen
   leesbaar zijn.

De browser gebruikt alleen native `fetch`: anoniem aanmelden via
`POST /auth/v1/signup` met `{ "data": {} }`, sessies vernieuwen via
`POST /auth/v1/token?grant_type=refresh_token`, lezen via
`GET /rest/v1/fitness_scores?select=display_name,total_reps,updated_at&order=total_reps.desc,updated_at.asc&limit=50`
en bijwerken via `POST /rest/v1/rpc/fitness_submit_score` met alleen
`p_display_name` en `p_total_reps`. De `apikey`-header bevat de publieke sleutel;
bij schrijven bevat `Authorization` uitsluitend de JWT van die deelnemer.

**Stoppen met delen** verbergt de eigen score via
`POST /rest/v1/rpc/fitness_leave_score`. De rij krijgt `active = false`; de openbare
SELECT-policy laat die rij niet meer zien. Eerst bewaart de client het stoppen
lokaal. Bij netwerkuitval probeert hij het verbergen later opnieuw en publiceert
hij geen nieuwe scores. Een expliciet tik op **Meedoen** activeert dezelfde rij
opnieuw. De privésessie blijft daarvoor op hetzelfde toestel bewaard.

De privésessie staat onder een afzonderlijke lokale sleutel en komt nooit in de
JSON-trainingsback-up of Git. Een naam is geen bewijs van identiteit: dubbele
namen zijn toegestaan. Een naamwijziging op hetzelfde toestel behoudt de
deelnemer. Wissen van websitegegevens, een verlopen/verwijderde anonieme sessie
of een ander toestel kan deze identiteit niet via de naam herstellen. Een
trainingsback-up terugzetten herstelt wel de trainingen; opnieuw meedoen maakt
dan een nieuwe ranglijstregel. Een ongeldige sessie wordt nooit stilzwijgend
vervangen door een nieuwe deelnemer.

Na lokaal opslaan wacht de app drie seconden en stuurt het actuele totaal.
Mislukte verzoeken blokkeren lokaal opslaan niet. De app probeert opnieuw bij
openen, terugkeren naar de app, terugkeer van verbinding of een volgende wijziging.
Ongewijzigde totaalscores worden niet telkens opnieuw verzonden.

De ingebouwde anonieme aanmeldlimiet van Supabase blijft ingeschakeld. Voor een
kleine speelse ranglijst volstaat dit als start; openbare scores zijn manipuleerbaar
en een grotere publieke uitrol vraagt aanvullende misbruikbescherming. Als CAPTCHA
in Supabase wordt ingeschakeld, moet ook een CAPTCHA-token aan de aanmeldflow
worden toegevoegd. Deze versie laadt geen externe CAPTCHA.

Bronnen: [anonieme deelnemers](https://supabase.com/docs/guides/auth/auth-anonymous),
[publieke API-sleutels](https://supabase.com/docs/guides/getting-started/api-keys),
[RLS en kolomrechten](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Auth REST-specificatie](https://github.com/supabase/auth/blob/master/openapi.yaml),
[officiële anonieme REST-aanroep](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts).

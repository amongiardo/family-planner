# DB Changes Log

Questo file traccia in modo sintetico le modifiche schema/database applicate tramite migrazioni Prisma.

## 2026-02-13

### `20260213113000_membership_status`
- Tabella: `family_members`
- Aggiunte colonne:
  - `status` (`MembershipStatus`: `active`/`left`, default `active`)
  - `left_at` (`TIMESTAMP`, nullable)
- Effetto:
  - supporto uscita/rientro famiglia senza perdere storico membership.

### `20260213162000_user_auth_code`
- Tabella: `users`
- Aggiunta colonna:
  - `auth_code` (`VARCHAR(5)`, nullable in schema ma backfillata per utenti esistenti)
- Backfill:
  - popolamento automatico codice a 5 caratteri per righe con valore `NULL`.
- Effetto:
  - codice di autenticazione distruttivo legato all'utente/account (email), condiviso su tutte le famiglie.

### `20260213192000_family_city_metadata`
- Tabella: `families`
- Aggiunte colonne:
  - `city_display_name` (`TEXT`)
  - `city_country` (`TEXT`)
  - `city_timezone` (`TEXT`)
  - `city_latitude` (`DOUBLE PRECISION`)
  - `city_longitude` (`DOUBLE PRECISION`)
- Effetto:
  - supporto selezione città disambiguata (mondo) e meteo affidabile su coordinate/timezone senza ambiguità.

## Note operative
- Per allineare DB locale a queste modifiche usare:
  - `./scripts/update_local.sh`
- Lo script esegue:
  - `prisma migrate deploy`
  - `prisma generate`
  - build backend
  - opzionale restart stack dev

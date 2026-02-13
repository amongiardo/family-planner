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

### `20260213220000_family_soft_delete_and_creator`
- Tabella: `families`
- Aggiunte colonne:
  - `created_by_user_id` (`TEXT`, FK -> `users.id`, `ON DELETE SET NULL`)
  - `deleted_at` (`TIMESTAMP`, nullable)
  - `deleted_by_user_id` (`TEXT`, FK -> `users.id`, `ON DELETE SET NULL`)
- Backfill:
  - `created_by_user_id` popolato dalla membership admin piu vecchia (fallback: membership piu vecchia).
- Effetto:
  - cancellazione famiglia in soft-delete (storico preservato).
  - tracciamento creatore/eliminatore per storico famiglie ex-membro.

### `20260214000500_notifications_chat_membership_removed`
- Tabella: `family_members`
- Modifica:
  - nuovo valore enum `MembershipStatus`: `removed`
  - nuova colonna `removed_at` (`TIMESTAMP`, nullable)
- Nuova tabella: `notifications`
  - campi principali: `user_id`, `family_id`, `type`, `title`, `message`, `is_read`, `data`, `created_at`
- Nuova tabella: `chat_messages`
  - campi principali: `family_id`, `sender_user_id`, `message_type`, `content`, `created_at`
- Effetto:
  - storico membership permanente con stato eliminato (no rientro diretto).
  - infrastruttura notifiche utente con polling.
  - chat famiglia persistente con messaggi utente/sistema.

## Note operative
- Per allineare DB locale a queste modifiche usare:
  - `./scripts/update_local.sh`
- Lo script esegue:
  - `prisma migrate deploy`
  - `prisma generate`
  - build backend
  - opzionale restart stack dev

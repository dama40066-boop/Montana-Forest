# Security Specification: Privacy-Preserving Unique Player Counter

## 1. Data Invariants & Zero-Trust Architecture
1. **Zero PII Principle**: No email, name, IP address, geolocation, device fingerprint, or personal identifier is stored or requested at any time.
2. **Identity Integrity**: Every player record in `/registered_players/{uid}` MUST have document ID equal to `request.auth.uid` and field `uid == request.auth.uid`.
3. **Single Registration Invariant**: A player document in `/registered_players/{uid}` can only be created once (`create`), cannot be overwritten, updated, or deleted by any client (`allow update, delete: if false`).
4. **Scraping Protection**: The `/registered_players` collection blocks `list` operations (`allow list: if false`) so no client can enumerate player records. Players can only perform `get` on their own UID document.
5. **Counter Atomic Linkage**: The `/stats/player_counter` document can only be incremented by exactly `+1` if and only if the player's unique registration document in `/registered_players/{uid}` is created in the exact same atomic transaction/batch (`existsAfter` invariant).
6. **Replay & Double-Count Prevention**: If `/registered_players/{uid}` already exists, subsequent attempts to increment the counter are strictly denied by rules checking `!exists(...)` before the write.
7. **Strict Schema & Server Timestamps**: Timestamps must equal `request.time` to prevent forged historical or future timestamps. No arbitrary ghost fields are permitted.

## 2. The "Dirty Dozen" Attack Vectors & Payloads
1. **Unauthenticated Write Attack**: An unauthenticated request attempts to create `/registered_players/any_user_123` -> REJECTED (`isSignedIn()` required).
2. **UID Spoofing Attack**: Authenticated user `anon_player_A` tries to create `/registered_players/anon_player_B` -> REJECTED (`request.auth.uid == uid`).
3. **Internal UID Mismatch Attack**: Authenticated user `anon_player_A` creates `/registered_players/anon_player_A` with payload `{ uid: 'anon_player_B' }` -> REJECTED (`incoming().uid == request.auth.uid`).
4. **Shadow Field Injection Attack**: User sends `{ uid: '...', registeredAt: request.time, isAdmin: true, score: 9999 }` -> REJECTED (`keys().size() == 2`).
5. **Client-Side Fake Timestamp Attack**: User sends a forged historical timestamp `{ registeredAt: timestamp(2020) }` -> REJECTED (`incoming().registeredAt == request.time`).
6. **Player Record Modification Attack**: User tries to update their existing registration document -> REJECTED (`allow update: if false`).
7. **Player Record Deletion Attack**: User tries to delete their registration document to reset count -> REJECTED (`allow delete: if false`).
8. **Direct Arbitrary Counter Jump Attack**: User attempts to update `/stats/player_counter` directly with `{ totalUniquePlayers: 999999 }` -> REJECTED (`incoming().totalUniquePlayers == existing().totalUniquePlayers + 1 && existsAfter(...)`).
9. **Double-Increment Replay Attack**: User who is already registered in `/registered_players/{uid}` attempts to increment the counter again -> REJECTED (`!exists(...)` required).
10. **Counter Decrement / Negative Delta Attack**: User attempts to set `totalUniquePlayers = totalUniquePlayers - 1` -> REJECTED (Only exact `+ 1` delta allowed).
11. **Directory Scraping / Mass Harvest Attack**: User attempts `getDocs(collection(db, 'registered_players'))` -> REJECTED (`allow list: if false`).
12. **PII Injection Attack**: User attempts to pass `email` or `ip` fields into registration -> REJECTED (Strict key count and exact required fields enforced).

## 3. Test Runner Specification
All 12 vectors are evaluated against the rule gates to confirm `PERMISSION_DENIED`.

# Admin cache server

The backend runs a second, loopback-only HTTP server for operational cache work that cannot
be done safely from outside the process. Source: `backend/src/admin/AdminServer.ts`.

## Security model

- Binds to `127.0.0.1:${ADMIN_PORT}` (default `5002`, `ADMIN_PORT=0` disables it) inside the
  backend container. It is not published by Docker and not proxied by Caddy.
- Reaching it therefore requires `docker exec` on the box, i.e. root access. There are no
  credentials to configure or leak.
- Defense in depth: a middleware rejects any request whose raw TCP peer is not a loopback
  address (`req.socket.remoteAddress`, never `req.ip`, which honours `X-Forwarded-For`).
- A failure to bind the admin port is logged and ignored; the public API keeps starting.

## Usage

```bash
# list the routes with their descriptions
sudo docker exec orbitar-backend-1 curl -s localhost:5002/

# evict a user from every in-process cache, by id or by (possibly stale) username
sudo docker exec orbitar-backend-1 curl -s -X POST localhost:5002/cache/users/evict \
  -H 'Content-Type: application/json' -d '{"username":"OldName"}'

# compare what the process has cached with the DB row
sudo docker exec orbitar-backend-1 curl -s 'localhost:5002/cache/users/inspect?userId=1625'
```

Responses use the public API envelope: `{"result":"success","payload":{...}}` or
`{"result":"error","code":"...","message":"..."}`. Every call is logged under the `ADMIN`
service with its parameters and result.

## Routes

| Method | Path | Parameters | What it touches |
| --- | --- | --- | --- |
| GET | `/cache/stats` | | sizes of every in-process cache |
| GET | `/cache/users/inspect` | `userId` or `username` | cached user entries next to the DB row; `drift` flags a username mismatch, `cache.consistent=false` flags an orphaned username key |
| POST | `/cache/users/evict` | `userId` or `username` | identity (by id and by every username key pointing at it), restrictions, last visit, feed subscriptions, content counters, invite availability |
| POST | `/cache/users/evict-all` | | all of the above for every user; the username trie is kept |
| POST | `/cache/usernames/rebuild` | | the `@mention` autocomplete trie, reloaded from the DB and swapped atomically |
| POST | `/cache/karma/evict` | `userId` or `username`, `asVoter` (default `false`) | Redis `active_karma_votes_<id>`, `trial_progress_<id>`, `remove_votes_when_karma_is_low_<id>`, `is_user_active_<id>`; with `asVoter` also the `active_karma_votes`/`trial_progress` of everyone the user has karma-voted |
| POST | `/cache/karma/evict-all` | | every key of those four families, via SCAN |
| POST | `/cache/sites/evict` | `siteId` or `site` | in-process site cache, by id and by subdomain |
| POST | `/cache/sites/evict-all` | | the whole site cache |
| POST | `/cache/sessions/evict` | `userId` or `sessionId` | in-memory session entries only |

`username` is resolved through the user cache first and the DB second, on purpose: the usual
reason to evict by name is that the cache still holds a name the DB no longer has.

`karma_penalty_<id>` is state set by hand, not a cache, and no route touches it.

## Scope rule

Routes are building blocks over a single cache each, never workflows. Anything that is already
easy with SQL or `redis-cli` stays out: data changes, re-rendering content (reset
`parser_version` on the row and the next read re-parses it), deleting Redis keys you can name.
The server exists only for state that lives in process memory, or that cannot be targeted
safely from outside because it is keyed by something other than the user id.

## Example: renaming a user

The steps stay manual; the server just makes each cache reachable.

1. `UPDATE users SET username = 'New' WHERE user_id = <id> AND username = 'Old';`
2. `POST /cache/users/evict {"userId": <id>}` — do this **before** touching Redis. Recomputing a
   Redis karma cache looks voters up by name, and if that happens while the process still holds
   the old identity it leaves an orphaned old-name key behind.
3. `POST /cache/karma/evict {"userId": <id>, "asVoter": true}` — the vote caches are keyed by
   voter username.
4. `POST /cache/usernames/rebuild` — the autocomplete trie only ever grows on registration.
5. `GET /cache/users/inspect?userId=<id>` — expect `drift: false` and `cache.consistent: true`.

Sessions key on the user id and survive the rename. Mentions and secret-mail envelopes inside
stored content embed the old name; whether to rewrite those is a separate, content-level decision.

## Forcing a logout

Deleting rows from `sessions` is not enough: the process keeps serving the cached copy until it
is evicted. Delete the rows, then `POST /cache/sessions/evict {"userId": <id>}`.

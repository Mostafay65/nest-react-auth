# End-to-end test report

A recorded run of the whole backend over real HTTP, on 2026-11-11. The API ran as the production Docker image, against MongoDB 8.2 in Docker. Every check was made twice: on the API's response, and on the documents in MongoDB. The web app was then tested in a browser against the same stack.

**Verdict: pass.**

- All 54 calls returned the expected status and body.
- Every database check passed.
- All 24 browser tests passed. See [Browser run](#browser-run).
- The automated suites are green: 50 contract tests, 100 API unit tests, 68 API end-to-end tests and 101 web tests.
- After the last fixes, the whole run was repeated on the final API image. Every call gave the same status and body; only IDs, tokens, hashes and times differed.

The first recording found two issues, both fixed before the run shown here. A code review after it led to further fixes, which steps 15a, 31a and 39–41 check. See [Findings](#findings).

## Environment

| Item      | Value                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack     | `docker compose`: the API image built from [`apps/api/Dockerfile`](../apps/api/Dockerfile) (Node 24.22.2, `NODE_ENV=production`, run as the unprivileged `node` user on a read-only file system with every Linux capability dropped), and `mongo:8.2` (MongoDB 8.2.12).                                                                                                       |
| Database  | `nest-react-auth-live-e2e`, dropped at the start of the run, so every document below was written by it.                                                                                                                                                                                                                                                                       |
| Address   | `http://127.0.0.1:3100`. The API port was published for this run only. In the normal stack, only nginx reaches the API.                                                                                                                                                                                                                                                       |
| Settings  | Access token 15 min. Refresh token 7 days. `TRUST_PROXY=1`. `COOKIE_SECURE=false`, because the compose stack serves plain HTTP on localhost; the production default, `true`, is checked by the automated suite. `SWAGGER_ENABLED=true`; production leaves the docs off unless this is set. The JWT secret is random, written to the git-ignored `.env` by `npm run stack:up`. |
| Test data | Synthetic accounts on `example.com`. The passwords shown are test values.                                                                                                                                                                                                                                                                                                     |
| Tokens    | Never shown. Access tokens appear as `<A1>`, `<A2>`…, refresh tokens as `<R1>`, `<R2>`…, in order of first appearance. Hand-made tokens are described in angle brackets.                                                                                                                                                                                                      |
| Tools     | A small Node 24 script that sends each request with `fetch` and records it. The database was read with `mongosh` inside the mongo container, and the logs with `docker logs`.                                                                                                                                                                                                 |

## Requirements covered

| #   | Requirement (task spec)                                                   | Steps                               | Result                                                                                                                               |
| --- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sign up with email, name and password                                     | 02, 39                              | ✅ 201: account created, session started                                                                                             |
| 2   | Email must be a valid address                                             | 04                                  | ✅ 400 `Enter a valid email address`                                                                                                 |
| 3   | Name of at least 3 characters                                             | 04, 41                              | ✅ 400 `Name must be at least 3 characters long`, also for three invisible characters                                                |
| 4   | Password of 8+ characters with a letter, a number and a special character | 04, 05                              | ✅ each failed rule is reported on its own                                                                                           |
| 5   | Sign in with email and password                                           | 16–18, 40                           | ✅ 200 for the right password, the same 401 for a wrong password or an unknown email                                                 |
| 6   | At least one protected endpoint                                           | 08–15a                              | ✅ `GET /api/v1/users/me`: 200 with a valid token, 401 for anything else                                                             |
| 7   | Data stored in MongoDB                                                    | [Database checks](#database-checks) | ✅                                                                                                                                   |
| 8   | Bonus: logging                                                            | 21, 29–33, 35, 36                   | ✅ every response carries `X-Request-Id`, which also appears in the logs and the error body                                          |
| 9   | Bonus: error handling                                                     | every 4xx below                     | ✅ RFC 9457 `application/problem+json` with a stable `code`                                                                          |
| 10  | Bonus: API documentation                                                  | 01                                  | ✅ OpenAPI 3.0 lists all 6 paths, and every error answer points to one shared `ProblemDetails` schema. Swagger UI is at `/api/docs`. |
| 11  | Production readiness: security                                            | sections C, E, G, H, I              | ✅                                                                                                                                   |

The web app's requirements (the forms, the welcome page, sign-out) are covered by the [browser run](#browser-run).

## Scenarios

### A. Health and API docs

| Step | Call                         | Expected                                           | Got                                                                                                      |
| ---- | ---------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 00   | `GET /api/health`            | 200, MongoDB up                                    | ✅ 200 `{"status":"ok"}`, `mongodb: up`                                                                  |
| 01   | `GET /api/docs/openapi.json` | the document, with every endpoint and every answer | ✅ 200, OpenAPI 3.0.0, 6 paths. Sign-in documents 200, 400, 401, 403, 413, 415, 429 and a default error. |

### B. Sign-up

| Step | Call                                                                      | Expected                          | Got                                                                                                                                              |
| ---- | ------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 02   | Sign up `ada@example.com`, `Ada Lovelace`, `Analytical1!`                 | 201, access token, refresh cookie | ✅ 201 · user `6af3dee7ab768b067a5599fe` · `expiresIn: 900` · `refresh_token=<R1>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict` |
| 03   | The same email, upper-case and padded with spaces: `"  ADA@Example.com "` | 409                               | ✅ 409 `EMAIL_ALREADY_REGISTERED`                                                                                                                |
| 04   | `not-an-email`, `Al`, `short`                                             | 400, every failed rule            | ✅ 400 `VALIDATION_FAILED` with 5 errors: email; name; password (length, number, special character)                                              |
| 05   | Password `Compiler1952`                                                   | 400, one rule                     | ✅ 400, only `…at least one special character…`                                                                                                  |
| 06   | An extra field, `"role": "admin"`                                         | 400                               | ✅ 400 `Unrecognized key: "role"`                                                                                                                |
| 07   | `"email": {"$ne": null}`                                                  | 400                               | ✅ 400 `Email must be a string`                                                                                                                  |

Steps 03–07 wrote nothing: the database holds one user (see [Database checks](#database-checks)).

### C. Protected endpoint: `GET /api/v1/users/me`

| Step | Call                                                             | Expected                        | Got                                                     |
| ---- | ---------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------- |
| 08   | With `<A1>` from step 02                                         | 200, the profile                | ✅ 200 `{id, email, name, createdAt}`, no password hash |
| 09   | No token                                                         | 401, `WWW-Authenticate: Bearer` | ✅ 401 `UNAUTHORIZED`, `WWW-Authenticate: Bearer`       |
| 10   | `Authorization: Basic …`                                         | 401                             | ✅ 401                                                  |
| 11   | `<A1>` with its `sub` edited                                     | 401                             | ✅ 401 `The access token is invalid or has expired.`    |
| 12   | An unsigned token (`alg: none`)                                  | 401                             | ✅ 401                                                  |
| 13   | A token signed with the API's own secret, expired 45 minutes ago | 401                             | ✅ 401                                                  |
| 14   | A token signed with the API's secret, for another audience       | 401                             | ✅ 401                                                  |
| 15   | The refresh token `<R1>` sent as a bearer token                  | 401                             | ✅ 401                                                  |
| 15a  | A token signed with the API's secret, with no `exp`              | 401                             | ✅ 401: a token that never expires is refused           |

Every 401 in this report carries `WWW-Authenticate: Bearer`, whichever route sent it.

The access token's claims (step 02, signature left out): `{"alg":"HS256","typ":"JWT"}` · `{"sub":"6af3dee7ab768b067a5599fe","iat":1794367207,"exp":1794368107,"aud":"nest-react-auth-web","iss":"nest-react-auth-api","jti":"a0452b48-…"}`. It lives 900 seconds.

### D. Sign-in

| Step | Call                                      | Expected           | Got                                                         |
| ---- | ----------------------------------------- | ------------------ | ----------------------------------------------------------- |
| 16   | `Ada@Example.com` with the right password | 200, a new session | ✅ 200 · `<A2>` · cookie `<R2>`                             |
| 17   | Wrong password                            | 401                | ✅ 401 `INVALID_CREDENTIALS` · 35 ms                        |
| 18   | Unknown email                             | the same 401       | ✅ the same body as step 17, apart from `requestId` · 36 ms |

### E. Refresh: rotation and reuse detection

| Step | Call                                                   | Expected                                                        | Got                                                                    |
| ---- | ------------------------------------------------------ | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 19   | Refresh with `<R2>`                                    | 200, a new access token, a rotated cookie                       | ✅ 200 · `<A3>` · cookie `<R3>`                                        |
| 20   | Refresh with `<R3>`                                    | 200, rotated again                                              | ✅ 200 · `<A4>` · cookie `<R4>`                                        |
| —    | Database                                               | R2 and R3 marked used, R4 active, the step 02 session untouched | ✅ see [Database checks](#database-checks)                             |
| 21   | Replay `<R2>`, which was already used                  | 401, the session ends, the cookie is cleared                    | ✅ 401 `INVALID_REFRESH_TOKEN` · `refresh_token=; Max-Age=0`           |
| 22   | Refresh with `<R4>`, the newest token of that session  | 401                                                             | ✅ 401: the replay ended the whole session, including the newest token |
| 23   | Refresh with `<R1>`, the separate session from step 02 | 200                                                             | ✅ 200 · `<A5>` · cookie `<R5>`: other sessions are untouched          |
| 24   | No cookie                                              | 401                                                             | ✅ 401 `INVALID_REFRESH_TOKEN`                                         |
| 25   | A made-up token                                        | 401                                                             | ✅ 401, and nothing is revoked                                         |

The API logged the replay at step 21 as a warning, with the request ID, the user ID and the session's `familyId`:

```json
{
  "level": 40,
  "req": {
    "id": "fd973976-09e0-4a32-8c81-3d0828b7fc55",
    "method": "POST",
    "url": "/api/v1/auth/refresh",
    "ip": "::ffff:172.20.0.1"
  },
  "context": "RefreshTokenService",
  "familyId": "f41b702c-1fa2-451f-9bfb-30a9cb6a53cc",
  "userId": "6af3dee7ab768b067a5599fe",
  "msg": "Refresh token reuse detected; session revoked"
}
```

### F. Sign-out

| Step | Call                             | Expected            | Got                                  |
| ---- | -------------------------------- | ------------------- | ------------------------------------ |
| 26   | Sign out with `<R5>`             | 204, cookie cleared | ✅ 204 · `refresh_token=; Max-Age=0` |
| 27   | Refresh with `<R5>`              | 401                 | ✅ 401                               |
| 28   | Sign out again, without a cookie | 204                 | ✅ 204: safe to repeat               |

### G. Malformed requests and cross-site protection

| Step | Call                                                                | Expected                                  | Got                                                                               |
| ---- | ------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- |
| 29   | A body that is not valid JSON                                       | 400, without echoing the parser's message | ✅ 400 `MALFORMED_REQUEST` `The request body is not valid JSON.`                  |
| 30   | An 11 kB body (the limit is 10 kB)                                  | 413                                       | ✅ 413 `PAYLOAD_TOO_LARGE`                                                        |
| 31   | A form-encoded body                                                 | 400                                       | ✅ 400 `The request body must be a JSON object`                                   |
| 31a  | JSON declared as `charset=latin1`                                   | 415                                       | ✅ 415 `UNSUPPORTED_MEDIA_TYPE` `The request body must be JSON encoded as UTF-8.` |
| 32   | A write with `Sec-Fetch-Site: cross-site`                           | 403                                       | ✅ 403 `FORBIDDEN`                                                                |
| 33   | A write with `Origin: https://evil.example` and no `Sec-Fetch-Site` | 403                                       | ✅ 403 `FORBIDDEN`                                                                |
| 34   | An unknown route                                                    | 404 problem+json                          | ✅ 404 `NOT_FOUND`                                                                |
| 35   | `X-Request-Id: live-e2e-35`                                         | the ID is kept                            | ✅ `X-Request-Id: live-e2e-35`                                                    |
| 36   | `X-Request-Id: two words`                                           | the ID is replaced                        | ✅ a new UUID                                                                     |

Steps 29, 30, 31a, 32 and 33 are rejected before routing, so the request logger never sees them. Each still gets a log line of its own, with the request ID and the client address. Step 31a's:

```json
{
  "level": 40,
  "context": "ProblemDetailsFilter",
  "requestId": "e32a2486-cf55-4c68-9270-b1590a15aab2",
  "method": "POST",
  "url": "/api/v1/auth/sign-in",
  "ip": "::ffff:172.20.0.1",
  "status": 415,
  "code": "UNSUPPORTED_MEDIA_TYPE",
  "msg": "Request rejected before routing"
}
```

### H. Rate limiting

| Step        | Call                                                 | Expected    | Got                                       |
| ----------- | ---------------------------------------------------- | ----------- | ----------------------------------------- |
| 37.01–37.10 | 10 sign-ins with a wrong password from `203.0.113.7` | 401 each    | ✅ 401 ×10                                |
| 37.11       | The 11th attempt in the same minute                  | 429         | ✅ 429 `RATE_LIMITED` · `Retry-After: 60` |
| 38          | The same request from `203.0.113.8`                  | not blocked | ✅ 401                                    |

The client address comes from `X-Forwarded-For`, because the API trusts one proxy hop (`TRUST_PROXY=1`). In the stack, that hop is nginx, which appends the real client address. A client therefore can't choose its own address. The API port was published only so this run could set the header directly.

### I. Names and passwords beyond ASCII

| Step | Call                                                                                                                          | Expected               | Got                                                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------- |
| 39   | Sign up `zoe@example.com` with a name of 50 emoji (the maximum) and the password `Café-1234!`, its `é` typed as one character | 201                    | ✅ 201 · user `6af3deebab768b067a559a05`, the name returned as sent |
| 40   | Sign in with the `é` typed as `e` plus a combining accent                                                                     | 200: the same password | ✅ 200 · `<A7>` · cookie `<R7>`                                     |
| 41   | A name of three zero-width spaces                                                                                             | 400                    | ✅ 400 `Name must be at least 3 characters long`                    |

Each emoji is one character to the user but two UTF-16 units to JavaScript. Step 39 checks that the API and the database count them the same way: the stored name is 50 characters, or 100 UTF-16 units, exactly as sent. Before the fix, Mongoose counted 100 against a limit of 50, and a name the validation had accepted failed with a 500.

## Database checks

**`users`, after section B:**

| `_id`                      | `email`           | `name`         | `passwordHash`                     | `createdAt`                |
| -------------------------- | ----------------- | -------------- | ---------------------------------- | -------------------------- |
| `6af3dee7ab768b067a5599fe` | `ada@example.com` | `Ada Lovelace` | `$argon2id$v=19$m=19456,t=2,p=1$…` | `2026-11-11T03:20:07.592Z` |

**`refresh_tokens`, after step 20 (before the replay):**

| Token  | Session (`familyId`) | `tokenHash`   | `usedAt`                   | `expiresAt`                |
| ------ | -------------------- | ------------- | -------------------------- | -------------------------- |
| `<R1>` | `146eb837…`          | `tVbJAUTvrB…` | —                          | `2026-11-18T03:20:07.596Z` |
| `<R2>` | `f41b702c…`          | `Ijk0hC0bF2…` | `2026-11-11T03:20:08.554Z` | `2026-11-18T03:20:08.470Z` |
| `<R3>` | `f41b702c…`          | `3pDmugACZy…` | `2026-11-11T03:20:08.567Z` | `2026-11-18T03:20:08.553Z` |
| `<R4>` | `f41b702c…`          | `gaQjj0PcBa…` | —                          | `2026-11-18T03:20:08.565Z` |

**`refresh_tokens`, after step 25 (after the replay):** only `<R1>` (now used) and `<R5>`, both in session `146eb837…`. **After step 26 (sign-out):** none.

| Check                                                  | Result                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| One user, written by step 02 only                      | ✅ 1 document. Steps 03–07 wrote nothing.                                                                                                          |
| Email stored trimmed and lower-cased                   | ✅ `ada@example.com`                                                                                                                               |
| Password stored as argon2id (19 MiB, 2 passes, 1 lane) | ✅ The plain password appears nowhere in the collection.                                                                                           |
| Refresh tokens stored only as SHA-256 hashes           | ✅ No raw token appears in the collection. Each `tokenHash` matches exactly one issued token.                                                      |
| Rotation retires the old token                         | ✅ `usedAt` is set on R2 and R3.                                                                                                                   |
| A replay deletes that session only                     | ✅ R2–R4 are gone. R1's session is untouched.                                                                                                      |
| Sign-out deletes the session                           | ✅ 0 refresh tokens left.                                                                                                                          |
| A name of 50 emoji is stored as sent                   | ✅ 50 characters, 100 UTF-16 units, identical to the request                                                                                       |
| At the end of the run                                  | ✅ 2 users (Ada and Zoe) and 2 refresh tokens, both Zoe's (steps 39 and 40)                                                                        |
| Indexes                                                | ✅ `users.email` unique · `refresh_tokens.tokenHash` unique · `refresh_tokens.familyId` · `refresh_tokens.expiresAt` TTL (`expireAfterSeconds: 0`) |

## Logs

The API's log for the whole run was read back after it. It holds no password, token, cookie or password hash. Failed sign-ins are logged with the user ID when the email is registered, and without any identifier when it is not.

## Timing

Sign-in must not reveal whether an email is registered. Each sample came from its own client address, so the rate limit stayed out of the way.

| Sign-in with     | Median  | Min     | Max     | Samples |
| ---------------- | ------- | ------- | ------- | ------- |
| A wrong password | 33.9 ms | 32.6 ms | 82.1 ms | 20      |
| An unknown email | 34.6 ms | 32.7 ms | 42.1 ms | 20      |

## Browser run

The web app, tested with Playwright 1.65 in Chromium 158 against the same Docker stack, through nginx at `http://localhost:8080`, as a user reaches it. One worker and no retries: 24 tests, all passed, in 25.0 s, on the final images. The run made 4 sign-ups and 7 sign-ins, under the API's limit of 10 a minute from one address. Every test also fails on an uncaught error, a content security policy violation or an unexpected console error.

| Area          | Tests | What they check                                                                                                                                                                                                                                                                                                                     | Result |
| ------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Journey       | 1     | A new user signs up, stays signed in across a reload, signs out and signs back in.                                                                                                                                                                                                                                                  | ✅     |
| Route guards  | 4     | A guest is sent to sign in from the app and start pages. A signed-in user is sent to the app from the start, sign-in and sign-up pages. An unknown address shows the not-found page.                                                                                                                                                | ✅     |
| Forms         | 4     | An empty submit marks every field and focuses the first, and only the focused field draws the focus bar. The password checklist ticks each rule off as it is met. "Email already registered" lands on the email field. A wrong password shows one alert and focuses it.                                                             | ✅     |
| Tabs          | 2     | A sign-in in one tab opens the app in both, and a sign-out closes both. When signing out fails, the user stays signed in, with focus still on Sign out.                                                                                                                                                                             | ✅     |
| Accessibility | 7     | axe (WCAG 2.2 A and AA) finds nothing on sign-in, sign-up (empty and with every field in error), welcome, not-found, a wrong password and a registered email, in the light and dark themes. No page scrolls sideways at 320px wide. On a phone, the masthead links, the theme button and the form buttons are at least 44px square. | ✅     |
| Theme         | 2     | On a device set to light, a picked Dark beats it and is back after a reload, applied before any of the app's code runs. On a device set to dark, Auto follows it and a picked Light beats it.                                                                                                                                       | ✅     |
| Security      | 4     | Pages carry the strict content security policy, and no page load trips it. A write carrying only an `Origin` is checked against the right host. Built assets are cached for good, and a missing one is not cached at all.                                                                                                           | ✅     |

## Findings

Found by the first recording, and fixed before this one:

1. **The first unknown-email sign-in after a restart was slower.** The first recording showed 65 ms for an unknown email against 35 ms for a wrong password. The throwaway hash used for unknown emails was created on first use. It is now prepared at startup ([`PasswordHasher.onModuleInit`](../apps/api/src/auth/password-hasher.ts)), with a unit test.
2. **Two access tokens issued in the same second were identical.** Steps 16, 19 and 20 returned the same JWT, because the claims were identical. Every token now carries a random `jti`, with a unit test.

Found earlier, in a manual smoke test against the same build:

- a body that was not valid JSON returned the parser's raw message and no request ID;
- the cookie's `Max-Age` was 604799 instead of 604800;
- the API docs had no examples.

All three were fixed before the first recording; steps 29, 02 and 01 show the results.

Found by the code review that followed ([AI.md](../AI.md#review-triage) has the full triage), fixed, and checked here:

- a validly signed token without `exp` never expired (step 15a);
- a name of 26 to 50 emoji passed validation, then failed with a 500 (step 39);
- an accent typed as one character or as two made two different passwords (step 40);
- three zero-width spaces made a valid name (step 41);
- a 415 carried the code meant for a 400, `MALFORMED_REQUEST` (step 31a);
- the 401s for a wrong password or a spent refresh token had no `WWW-Authenticate` header (steps 17, 18, 21);
- requests rejected before routing were logged without the client address (section G).

A final review of the whole change found one more problem in the API: a name such as "A B", which shows three characters, was refused, because the minimum ignored spaces. Spaces between letters now count; a contract test covers it. The repeated run, on the image with this fix, gave the same results.

## Automated tests

| Suite                                                                                               | Command                                  | Result                                                                                                            |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Shared contracts: Zod schemas and the password rules                                                | `npm test -w @nest-react-auth/contracts` | 50 passed                                                                                                         |
| API unit: services, guard, error filter, config, middleware                                         | `npm test -w @nest-react-auth/api`       | 100 passed, 100% of lines in every service                                                                        |
| API end-to-end: the real app through `createApp()`, against `mongodb-memory-server` (MongoDB 8.2.6) | `npm run test:e2e`                       | 68 passed in about 5 s                                                                                            |
| Web: forms, session, route guards, HTTP client (Vitest, Testing Library, MSW)                       | `npm test -w @nest-react-auth/web`       | 101 passed                                                                                                        |
| Browser: the [browser run](#browser-run) above                                                      | `npm run test:browser`                   | 24 passed                                                                                                         |
| Lint (`oxlint --type-aware --deny-warnings`, ESLint for the web app), typecheck, build, formatting  | root `npm run …` scripts                 | clean                                                                                                             |
| Container scan (Trivy, HIGH and CRITICAL with a fix)                                                | both images                              | 0 findings. The stock `node:24-alpine` has 6 HIGH, all in packages bundled with npm, which the API image removes. |

Every scenario in sections A–I is also an automated test, in [`apps/api/test`](../apps/api/test) or in the unit specs next to the code.

## Decisions

Made by the project owner, 2026-11-10:

- every bonus item is in scope;
- the repository is `Mostafay65/nest-react-auth`;
- the web app uses an editorial "paper and ink" design.

Made in engineering:

1. **Where the tokens live.** The access token lasts 15 minutes. It travels in the response body, and the web app keeps it in memory only. The refresh token sits in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Scripts can't read it, and other routes never receive it.
2. **Rotation and reuse detection.** Refresh tokens rotate on every use, and a replayed token ends the whole session (RFC 9700 §4.14.2). There is no grace period. The web app therefore runs refreshes one at a time across tabs (Web Locks), so two tabs never present the same token.
3. **Session length.** The session slides: each refresh starts a new 7-day window.
4. **Duplicate sign-up.** It answers 409, as the sign-up form needs, which shows that the email is registered. The rate limit slows down anyone listing emails this way. Sign-in never reveals whether an email exists.
5. **Rate limits per client IP.** 10 per minute on sign-up and sign-in, 100 per minute elsewhere. The health check is exempt.
6. **`COOKIE_SECURE=false` only in the local compose file**, which serves plain HTTP. The default is `true`.

## Out of scope unless asked

- Email verification and password reset.
- Lockout per account, as opposed to per IP.
- Multi-factor sign-in.
- "Sign out everywhere", and an absolute session lifetime.
- A grace period for a refresh token presented twice within a few seconds.

## Requests and responses

Every call, in the order it ran. Click a step to open it. Tokens are replaced by labels (`<A1>` for access tokens, `<R1>` for refresh tokens, numbered in order of first appearance). Response headers are limited to the ones that matter here.

### A. Health and API docs

<details>
<summary><code>00</code> Health check: <code>GET /api/health</code> → <b>200</b> · 7 ms</summary>

```http
GET /api/health
```

**Response** `200 OK` · 7 ms

```http
content-type: application/json; charset=utf-8
x-request-id: e63dd3ac-eff8-43ca-87bd-30e9ab4eec40
cache-control: no-cache, no-store, must-revalidate
```

```json
{
  "status": "ok",
  "info": {
    "mongodb": {
      "responseTime": 1,
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "mongodb": {
      "responseTime": 1,
      "status": "up"
    }
  }
}
```

</details>

<details>
<summary><code>01</code> OpenAPI document (paths only): <code>GET /api/docs/openapi.json</code> → <b>200</b> · 4 ms</summary>

```http
GET /api/docs/openapi.json
```

**Response** `200 OK` · 4 ms · trimmed to the parts that matter

```http
content-type: application/json; charset=utf-8
x-request-id: c546c093-2c00-45b8-8dcb-edf9e6520972
cache-control: no-store
```

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "nest-react-auth API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/health": ["get"],
    "/api/v1/users/me": ["get"],
    "/api/v1/auth/sign-up": ["post"],
    "/api/v1/auth/sign-in": ["post"],
    "/api/v1/auth/refresh": ["post"],
    "/api/v1/auth/sign-out": ["post"]
  },
  "componentSchemas": ["ProblemDetails"],
  "signInResponses": ["200", "400", "401", "403", "413", "415", "429", "default"]
}
```

</details>

### B. Sign-up

<details>
<summary><code>02</code> Create an account: <code>POST /api/v1/auth/sign-up</code> → <b>201</b> · 68 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "password": "Analytical1!"
}
```

**Response** `201 Created` · 68 ms

```http
set-cookie: refresh_token=<R1>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 248ec250-f1dd-4dcf-baaf-45516b728929
cache-control: no-store
```

```json
{
  "accessToken": "<A1>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3dee7ab768b067a5599fe",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-11T03:20:07.592Z"
  }
}
```

</details>

<details>
<summary><code>03</code> Same email again, upper-case and padded with spaces: <code>POST /api/v1/auth/sign-up</code> → <b>409</b> · 41 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "  ADA@Example.com ",
  "name": "Ada Again",
  "password": "Analytical2!"
}
```

**Response** `409 Conflict` · 41 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: eb7c347b-35f4-4e94-a6e2-150b3e7125ea
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "An account with this email already exists.",
  "instance": "/api/v1/auth/sign-up",
  "code": "EMAIL_ALREADY_REGISTERED",
  "requestId": "eb7c347b-35f4-4e94-a6e2-150b3e7125ea"
}
```

</details>

<details>
<summary><code>04</code> Every field invalid: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "not-an-email",
  "name": "Al",
  "password": "short"
}
```

**Response** `400 Bad Request` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 6e5ec673-8e6b-4305-9750-0976bbc5bf5c
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "6e5ec673-8e6b-4305-9750-0976bbc5bf5c",
  "errors": [
    {
      "field": "email",
      "message": "Enter a valid email address"
    },
    {
      "field": "name",
      "message": "Name must be at least 3 characters long"
    },
    {
      "field": "password",
      "message": "Password must be at least 8 characters long"
    },
    {
      "field": "password",
      "message": "Password must contain at least one number"
    },
    {
      "field": "password",
      "message": "Password must contain at least one special character, such as ! ? # or @"
    }
  ]
}
```

</details>

<details>
<summary><code>05</code> Password without a special character: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "grace@example.com",
  "name": "Grace Hopper",
  "password": "Compiler1952"
}
```

**Response** `400 Bad Request` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 9d216bda-e770-4bc3-8a70-ad7624389441
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "9d216bda-e770-4bc3-8a70-ad7624389441",
  "errors": [
    {
      "field": "password",
      "message": "Password must contain at least one special character, such as ! ? # or @"
    }
  ]
}
```

</details>

<details>
<summary><code>06</code> Extra field: role: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "grace@example.com",
  "name": "Grace Hopper",
  "password": "Compiler#1952",
  "role": "admin"
}
```

**Response** `400 Bad Request` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 99ea37c9-5210-41f2-9468-e4ce918d2ab0
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "99ea37c9-5210-41f2-9468-e4ce918d2ab0",
  "errors": [
    {
      "message": "Unrecognized key: \"role\""
    }
  ]
}
```

</details>

<details>
<summary><code>07</code> MongoDB operator instead of an email: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": {
    "$ne": null
  },
  "name": "Mallory",
  "password": "Analytical1!"
}
```

**Response** `400 Bad Request` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 9b0f4f14-bea6-49e6-b9ae-ab40f6ffa111
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "9b0f4f14-bea6-49e6-b9ae-ab40f6ffa111",
  "errors": [
    {
      "field": "email",
      "message": "Email must be a string"
    }
  ]
}
```

</details>

<details>
<summary>DB check after sign-up (mongosh)</summary>

```json
{
  "users": [
    {
      "_id": "6af3dee7ab768b067a5599fe",
      "email": "ada@example.com",
      "name": "Ada Lovelace",
      "passwordHash": "$argon2id$v=19$m=19456,t=2,p=1$…",
      "createdAt": {
        "$date": "2026-11-11T03:20:07.592Z"
      },
      "updatedAt": {
        "$date": "2026-11-11T03:20:07.592Z"
      }
    }
  ],
  "plaintextPasswordStored": false
}
```

</details>

### C. Protected endpoint: GET /api/v1/users/me

<details>
<summary><code>08</code> With the access token from step 02: <code>GET /api/v1/users/me</code> → <b>200</b> · 11 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <A1>
```

**Response** `200 OK` · 11 ms

```http
content-type: application/json; charset=utf-8
x-request-id: b0ba31c4-fd0f-45fc-ad98-51c9b8556c74
cache-control: no-store
```

```json
{
  "id": "6af3dee7ab768b067a5599fe",
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "createdAt": "2026-11-11T03:20:07.592Z"
}
```

</details>

<details>
<summary><code>09</code> Without a token: <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 1d0b27be-def9-429b-a173-273ab23374c4
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Send an access token as `Authorization: Bearer <token>`.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "1d0b27be-def9-429b-a173-273ab23374c4"
}
```

</details>

<details>
<summary><code>10</code> With a Basic header: <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
Authorization: Basic YWRhOnNlY3JldA==
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 10b809af-7d99-4279-b263-1e132e77592a
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Send an access token as `Authorization: Bearer <token>`.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "10b809af-7d99-4279-b263-1e132e77592a"
}
```

</details>

<details>
<summary><code>11</code> Token whose payload was edited: <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <A1 with its sub changed>
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: bf5b3eb5-a034-4b02-8dc1-d15764f09373
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "bf5b3eb5-a034-4b02-8dc1-d15764f09373"
}
```

</details>

<details>
<summary><code>12</code> Unsigned token (alg: none): <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <unsigned token, alg none>
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 6ba3ce80-0192-42ba-803e-a75cb16093ca
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "6ba3ce80-0192-42ba-803e-a75cb16093ca"
}
```

</details>

<details>
<summary><code>13</code> Expired token: <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <token signed with the API secret, expired 45 minutes ago>
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: a9038514-6a05-4ef1-b23f-0862b688538d
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "a9038514-6a05-4ef1-b23f-0862b688538d"
}
```

</details>

<details>
<summary><code>14</code> Token issued for another audience: <code>GET /api/v1/users/me</code> → <b>401</b> · 2 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <token signed with the API secret, audience another-service>
```

**Response** `401 Unauthorized` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: f94527eb-8a83-48aa-8c90-93d3cb93064c
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "f94527eb-8a83-48aa-8c90-93d3cb93064c"
}
```

</details>

<details>
<summary><code>15</code> The refresh token used as a bearer token: <code>GET /api/v1/users/me</code> → <b>401</b> · 2 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <R1>
```

**Response** `401 Unauthorized` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: f47c04c7-b83c-4401-bc93-48d11582373b
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "f47c04c7-b83c-4401-bc93-48d11582373b"
}
```

</details>

<details>
<summary><code>15a</code> Validly signed token without an expiry: <code>GET /api/v1/users/me</code> → <b>401</b> · 2 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <token signed with the API secret, without exp>
```

**Response** `401 Unauthorized` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: dea1ee7f-e5a4-4ef1-84b4-5e1aa7508ee1
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "dea1ee7f-e5a4-4ef1-84b4-5e1aa7508ee1"
}
```

</details>

### D. Sign-in

<details>
<summary><code>16</code> Correct password, email in another letter case: <code>POST /api/v1/auth/sign-in</code> → <b>200</b> · 39 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "Ada@Example.com",
  "password": "Analytical1!"
}
```

**Response** `200 OK` · 39 ms

```http
set-cookie: refresh_token=<R2>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 0f8bbd70-193a-4e0c-b37d-fe64ad3a7c02
cache-control: no-store
```

```json
{
  "accessToken": "<A2>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3dee7ab768b067a5599fe",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-11T03:20:07.592Z"
  }
}
```

</details>

<details>
<summary><code>17</code> Wrong password: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 35 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "Analytical1?"
}
```

**Response** `401 Unauthorized` · 35 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 069dbaa5-4b2f-47ba-9d0e-7362941bf0ec
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "069dbaa5-4b2f-47ba-9d0e-7362941bf0ec"
}
```

</details>

<details>
<summary><code>18</code> Unknown email: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 36 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "nobody@example.com",
  "password": "Analytical1!"
}
```

**Response** `401 Unauthorized` · 36 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 42d0c684-8342-4ad4-b88d-572e0ee8c0b1
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "42d0c684-8342-4ad4-b88d-572e0ee8c0b1"
}
```

</details>

### E. Refresh: rotation and reuse detection

<details>
<summary><code>19</code> Refresh with R2 (from step 16): <code>POST /api/v1/auth/refresh</code> → <b>200</b> · 12 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R2>
```

**Response** `200 OK` · 12 ms

```http
set-cookie: refresh_token=<R3>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 95686503-d013-4d13-8628-3ae32fdf9953
cache-control: no-store
```

```json
{
  "accessToken": "<A3>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3dee7ab768b067a5599fe",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-11T03:20:07.592Z"
  }
}
```

</details>

<details>
<summary><code>20</code> Refresh with R3: <code>POST /api/v1/auth/refresh</code> → <b>200</b> · 9 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R3>
```

**Response** `200 OK` · 9 ms

```http
set-cookie: refresh_token=<R4>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: d0e15f5a-a4a7-4c6e-9951-d66551f0834d
cache-control: no-store
```

```json
{
  "accessToken": "<A4>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3dee7ab768b067a5599fe",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-11T03:20:07.592Z"
  }
}
```

</details>

<details>
<summary>DB check before the replay (mongosh)</summary>

```json
{
  "refresh_tokens": [
    {
      "token": "<R1>",
      "family": "146eb837",
      "tokenHash": "tVbJAUTvrB…",
      "usedAt": null,
      "expiresAt": {
        "$date": "2026-11-18T03:20:07.596Z"
      }
    },
    {
      "token": "<R2>",
      "family": "f41b702c",
      "tokenHash": "Ijk0hC0bF2…",
      "usedAt": {
        "$date": "2026-11-11T03:20:08.554Z"
      },
      "expiresAt": {
        "$date": "2026-11-18T03:20:08.470Z"
      }
    },
    {
      "token": "<R3>",
      "family": "f41b702c",
      "tokenHash": "3pDmugACZy…",
      "usedAt": {
        "$date": "2026-11-11T03:20:08.567Z"
      },
      "expiresAt": {
        "$date": "2026-11-18T03:20:08.553Z"
      }
    },
    {
      "token": "<R4>",
      "family": "f41b702c",
      "tokenHash": "gaQjj0PcBa…",
      "usedAt": null,
      "expiresAt": {
        "$date": "2026-11-18T03:20:08.565Z"
      }
    }
  ],
  "rawTokenStored": false
}
```

</details>

<details>
<summary><code>21</code> Replay R2, which was already used: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 7 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R2>
```

**Response** `401 Unauthorized` · 7 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: fd973976-09e0-4a32-8c81-3d0828b7fc55
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "fd973976-09e0-4a32-8c81-3d0828b7fc55"
}
```

</details>

<details>
<summary><code>22</code> Refresh with R4, the newest token of that session: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 4 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R4>
```

**Response** `401 Unauthorized` · 4 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 4fdb7c0d-665c-4bd3-8e88-779440608be2
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "4fdb7c0d-665c-4bd3-8e88-779440608be2"
}
```

</details>

<details>
<summary><code>23</code> Refresh with R1, the separate session from sign-up: <code>POST /api/v1/auth/refresh</code> → <b>200</b> · 8 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R1>
```

**Response** `200 OK` · 8 ms

```http
set-cookie: refresh_token=<R5>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 2cb8ce3f-8e02-401a-9f25-89d71a5bd7bf
cache-control: no-store
```

```json
{
  "accessToken": "<A5>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3dee7ab768b067a5599fe",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-11T03:20:07.592Z"
  }
}
```

</details>

<details>
<summary><code>24</code> Refresh without a cookie: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 2 ms</summary>

```http
POST /api/v1/auth/refresh
```

**Response** `401 Unauthorized` · 2 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: b3a909f4-8950-4343-b846-3cfb2b994964
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "b3a909f4-8950-4343-b846-3cfb2b994964"
}
```

</details>

<details>
<summary><code>25</code> Refresh with a made-up token: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 4 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=made-up-token
```

**Response** `401 Unauthorized` · 4 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 64c97c52-161d-4f6f-81bf-fd92dc70ffb3
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "64c97c52-161d-4f6f-81bf-fd92dc70ffb3"
}
```

</details>

<details>
<summary>DB check after the replay (mongosh)</summary>

```json
{
  "refresh_tokens": [
    {
      "token": "<R1>",
      "family": "146eb837",
      "usedAt": {
        "$date": "2026-11-11T03:20:09.302Z"
      }
    },
    {
      "token": "<R5>",
      "family": "146eb837",
      "usedAt": null
    }
  ]
}
```

</details>

### F. Sign-out

<details>
<summary><code>26</code> Sign out with R5: <code>POST /api/v1/auth/sign-out</code> → <b>204</b> · 6 ms</summary>

```http
POST /api/v1/auth/sign-out
Cookie: refresh_token=<R5>
```

**Response** `204 No Content` · 6 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
x-request-id: 0c766b4f-384f-4ea1-a0ee-af5657e6815e
cache-control: no-store
```

</details>

<details>
<summary><code>27</code> Refresh with R5 after sign-out: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 4 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R5>
```

**Response** `401 Unauthorized` · 4 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 6d7c2bbf-b3e4-4ffc-9808-676ff40be13a
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "6d7c2bbf-b3e4-4ffc-9808-676ff40be13a"
}
```

</details>

<details>
<summary><code>28</code> Sign out again, without a cookie: <code>POST /api/v1/auth/sign-out</code> → <b>204</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-out
```

**Response** `204 No Content` · 3 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
x-request-id: d0b2bc0c-a187-43c2-9894-63c66e39015b
cache-control: no-store
```

</details>

<details>
<summary>DB check after sign-out (mongosh)</summary>

```json
{
  "refreshTokensLeft": 0
}
```

</details>

### G. Malformed requests and cross-site protection

<details>
<summary><code>29</code> Body that is not valid JSON: <code>POST /api/v1/auth/sign-in</code> → <b>400</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```text
{"email": "ada@example.com",
```

**Response** `400 Bad Request` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: c649b8f1-8f6e-4a51-97b9-4384a1f26527
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request body is not valid JSON.",
  "instance": "/api/v1/auth/sign-in",
  "code": "MALFORMED_REQUEST",
  "requestId": "c649b8f1-8f6e-4a51-97b9-4384a1f26527"
}
```

</details>

<details>
<summary><code>30</code> Body over 10 kB: <code>POST /api/v1/auth/sign-up</code> → <b>413</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```text
{"email":"big@example.com","name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx… (11327 characters)
```

**Response** `413 Payload Too Large` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: b04c9943-56a4-4e5a-a1a7-54376b35df91
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "The request body is too large.",
  "instance": "/api/v1/auth/sign-up",
  "code": "PAYLOAD_TOO_LARGE",
  "requestId": "b04c9943-56a4-4e5a-a1a7-54376b35df91"
}
```

</details>

<details>
<summary><code>31</code> Form-encoded body instead of JSON: <code>POST /api/v1/auth/sign-in</code> → <b>400</b> · 2 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/x-www-form-urlencoded
```

```text
email=ada%40example.com&password=Analytical1!
```

**Response** `400 Bad Request` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: cd737b5f-e6a0-4855-b8ee-b4969a90c3dd
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-in",
  "code": "VALIDATION_FAILED",
  "requestId": "cd737b5f-e6a0-4855-b8ee-b4969a90c3dd",
  "errors": [
    {
      "message": "The request body must be a JSON object"
    }
  ]
}
```

</details>

<details>
<summary><code>31a</code> JSON declared as Latin-1: <code>POST /api/v1/auth/sign-in</code> → <b>415</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json; charset=latin1
```

```text
{"email":"ada@example.com","password":"Analytical1!"}
```

**Response** `415 Unsupported Media Type` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: e32a2486-cf55-4c68-9270-b1590a15aab2
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unsupported Media Type",
  "status": 415,
  "detail": "The request body must be JSON encoded as UTF-8.",
  "instance": "/api/v1/auth/sign-in",
  "code": "UNSUPPORTED_MEDIA_TYPE",
  "requestId": "e32a2486-cf55-4c68-9270-b1590a15aab2"
}
```

</details>

<details>
<summary><code>32</code> Write from another site (Sec-Fetch-Site: cross-site): <code>POST /api/v1/auth/sign-out</code> → <b>403</b> · 2 ms</summary>

```http
POST /api/v1/auth/sign-out
Sec-Fetch-Site: cross-site
```

**Response** `403 Forbidden` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 23ba97b4-3589-4736-8859-18c8f2559cea
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "Cross-origin request detected from Sec-Fetch-Site header",
  "instance": "/api/v1/auth/sign-out",
  "code": "FORBIDDEN",
  "requestId": "23ba97b4-3589-4736-8859-18c8f2559cea"
}
```

</details>

<details>
<summary><code>33</code> Write from a foreign Origin, no Sec-Fetch-Site: <code>POST /api/v1/auth/sign-in</code> → <b>403</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-in
Origin: https://evil.example
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "password": "Analytical1!"
}
```

**Response** `403 Forbidden` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 04951a7a-77ca-40c5-a4dc-3fe872fe35e0
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "Cross-origin request detected, and/or browser is out of date: Sec-Fetch-Site is missing, and Origin does not match Host",
  "instance": "/api/v1/auth/sign-in",
  "code": "FORBIDDEN",
  "requestId": "04951a7a-77ca-40c5-a4dc-3fe872fe35e0"
}
```

</details>

<details>
<summary><code>34</code> Unknown route: <code>GET /api/v1/nope</code> → <b>404</b> · 4 ms</summary>

```http
GET /api/v1/nope
```

**Response** `404 Not Found` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 27de61f5-1357-45ee-975c-496ae783e5a8
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Cannot GET /api/v1/nope",
  "instance": "/api/v1/nope",
  "code": "NOT_FOUND",
  "requestId": "27de61f5-1357-45ee-975c-496ae783e5a8"
}
```

</details>

<details>
<summary><code>35</code> Caller's request ID is kept: <code>GET /api/health</code> → <b>200</b> · 5 ms</summary>

```http
GET /api/health
X-Request-Id: live-e2e-35
```

**Response** `200 OK` · 5 ms · trimmed to the parts that matter

```http
content-type: application/json; charset=utf-8
x-request-id: live-e2e-35
cache-control: no-cache, no-store, must-revalidate
```

```json
{
  "status": "ok"
}
```

</details>

<details>
<summary><code>36</code> Unsafe request ID is replaced: <code>GET /api/health</code> → <b>200</b> · 6 ms</summary>

```http
GET /api/health
X-Request-Id: two words
```

**Response** `200 OK` · 6 ms · trimmed to the parts that matter

```http
content-type: application/json; charset=utf-8
x-request-id: c222c346-e204-4180-8d19-f984e97f4103
cache-control: no-cache, no-store, must-revalidate
```

```json
{
  "status": "ok"
}
```

</details>

### H. Rate limiting (10 credential attempts per minute per client IP)

<details>
<summary><code>37.01</code> Attempt 1 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 57 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-1"
}
```

**Response** `401 Unauthorized` · 57 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: bda0ddc2-a925-4505-b08f-892a379b34eb
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "bda0ddc2-a925-4505-b08f-892a379b34eb"
}
```

</details>

<details>
<summary><code>37.02</code> Attempt 2 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 54 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-2"
}
```

**Response** `401 Unauthorized` · 54 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: d90a5ca7-2722-4f35-bd55-bdc662d3eea5
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "d90a5ca7-2722-4f35-bd55-bdc662d3eea5"
}
```

</details>

<details>
<summary><code>37.03</code> Attempt 3 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 43 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-3"
}
```

**Response** `401 Unauthorized` · 43 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: d0fb6d65-5086-4cfa-839b-6468c24c27ac
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "d0fb6d65-5086-4cfa-839b-6468c24c27ac"
}
```

</details>

<details>
<summary><code>37.04</code> Attempt 4 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 39 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-4"
}
```

**Response** `401 Unauthorized` · 39 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: fbe7ce22-4608-4d6f-87f0-7a624bc6a152
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "fbe7ce22-4608-4d6f-87f0-7a624bc6a152"
}
```

</details>

<details>
<summary><code>37.05</code> Attempt 5 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 39 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-5"
}
```

**Response** `401 Unauthorized` · 39 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 68427a2a-4835-4b04-bd5b-ca4e9c9957aa
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "68427a2a-4835-4b04-bd5b-ca4e9c9957aa"
}
```

</details>

<details>
<summary><code>37.06</code> Attempt 6 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 40 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-6"
}
```

**Response** `401 Unauthorized` · 40 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 4a0d98c4-e9bc-41ae-b89d-4f36cf6037dc
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "4a0d98c4-e9bc-41ae-b89d-4f36cf6037dc"
}
```

</details>

<details>
<summary><code>37.07</code> Attempt 7 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 37 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-7"
}
```

**Response** `401 Unauthorized` · 37 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 5aed06f8-7c14-42ef-a4e5-97e28366c288
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "5aed06f8-7c14-42ef-a4e5-97e28366c288"
}
```

</details>

<details>
<summary><code>37.08</code> Attempt 8 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 39 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-8"
}
```

**Response** `401 Unauthorized` · 39 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 93227259-f165-49b0-9d27-e6cdbbd3b060
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "93227259-f165-49b0-9d27-e6cdbbd3b060"
}
```

</details>

<details>
<summary><code>37.09</code> Attempt 9 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 38 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-9"
}
```

**Response** `401 Unauthorized` · 38 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 8e71c970-409e-4cc2-a57d-0bb009698bdb
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "8e71c970-409e-4cc2-a57d-0bb009698bdb"
}
```

</details>

<details>
<summary><code>37.10</code> Attempt 10 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 41 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-10"
}
```

**Response** `401 Unauthorized` · 41 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 8569aa5e-4dd1-408f-895e-3ddcc5e04052
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "8569aa5e-4dd1-408f-895e-3ddcc5e04052"
}
```

</details>

<details>
<summary><code>37.11</code> Attempt 11 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>429</b> · 4 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.7
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-11"
}
```

**Response** `429 Too Many Requests` · 4 ms

```http
content-type: application/problem+json; charset=utf-8
retry-after: 60
x-request-id: f0753e28-7c77-49f6-8217-fc2f73f35697
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Too many requests. Please wait a minute and try again.",
  "instance": "/api/v1/auth/sign-in",
  "code": "RATE_LIMITED",
  "requestId": "f0753e28-7c77-49f6-8217-fc2f73f35697"
}
```

</details>

<details>
<summary><code>38</code> Same request from another client (203.0.113.8): <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 38 ms</summary>

```http
POST /api/v1/auth/sign-in
X-Forwarded-For: 203.0.113.8
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "guess-1"
}
```

**Response** `401 Unauthorized` · 38 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: b7552ca9-40b8-466f-89c6-56ffa760c698
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "b7552ca9-40b8-466f-89c6-56ffa760c698"
}
```

</details>

### I. Names and passwords beyond ASCII

<details>
<summary><code>39</code> A name of 50 emoji, a password with a composed "é": <code>POST /api/v1/auth/sign-up</code> → <b>201</b> · 41 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "zoe@example.com",
  "name": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
  "password": "Café-1234!"
}
```

**Response** `201 Created` · 41 ms

```http
set-cookie: refresh_token=<R6>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: d4d5f039-17a0-4cac-b774-f39a14714eff
cache-control: no-store
```

```json
{
  "accessToken": "<A6>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3deebab768b067a559a05",
    "email": "zoe@example.com",
    "name": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
    "createdAt": "2026-11-11T03:20:11.349Z"
  }
}
```

</details>

<details>
<summary>DB check: the emoji name (mongosh)</summary>

```json
{
  "codePoints": 50,
  "utf16Units": 100,
  "storedAsSent": true,
  "returnedAsSent": true
}
```

</details>

<details>
<summary><code>40</code> Sign in with the "é" typed as "e" plus a combining accent: <code>POST /api/v1/auth/sign-in</code> → <b>200</b> · 38 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```json
{
  "email": "zoe@example.com",
  "password": "Café-1234!"
}
```

**Response** `200 OK` · 38 ms

```http
set-cookie: refresh_token=<R7>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 82ff0c94-f04e-4ae5-9833-7b64fe6cb13e
cache-control: no-store
```

```json
{
  "accessToken": "<A7>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af3deebab768b067a559a05",
    "email": "zoe@example.com",
    "name": "😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀😀",
    "createdAt": "2026-11-11T03:20:11.349Z"
  }
}
```

</details>

<details>
<summary><code>41</code> A name of three zero-width spaces: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```json
{
  "email": "blank@example.com",
  "name": "\u200B\u200B\u200B",
  "password": "Analytical1!"
}
```

**Response** `400 Bad Request` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 730ac8c3-c1dc-48ec-af4f-2903ce5c3b8f
cache-control: no-store
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "730ac8c3-c1dc-48ec-af4f-2903ce5c3b8f",
  "errors": [
    {
      "field": "name",
      "message": "Name must be at least 3 characters long"
    }
  ]
}
```

</details>

<details>
<summary>Final DB state (mongosh)</summary>

```json
{
  "users": 2,
  "refresh_tokens": 2,
  "indexes": {
    "users": [
      {
        "v": 2,
        "key": {
          "_id": 1
        },
        "name": "_id_"
      },
      {
        "v": 2,
        "key": {
          "email": 1
        },
        "name": "email_1",
        "unique": true
      }
    ],
    "refresh_tokens": [
      {
        "v": 2,
        "key": {
          "_id": 1
        },
        "name": "_id_"
      },
      {
        "v": 2,
        "key": {
          "familyId": 1
        },
        "name": "familyId_1"
      },
      {
        "v": 2,
        "key": {
          "tokenHash": 1
        },
        "name": "tokenHash_1",
        "unique": true
      },
      {
        "v": 2,
        "key": {
          "expiresAt": 1
        },
        "name": "expiresAt_1",
        "expireAfterSeconds": 0
      }
    ]
  }
}
```

</details>

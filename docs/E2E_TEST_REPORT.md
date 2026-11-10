# End-to-end test report

A recorded run of the whole backend over real HTTP, on 2026-11-10. The API ran as the production Docker image, against MongoDB 8.2 in Docker. Every check was made twice: on the API's response, and on the documents in MongoDB.

**Verdict: pass.**

- All 49 calls returned the expected status and body.
- Every database check passed.
- The automated suites are green: 37 contract tests, 81 API unit tests and 54 API end-to-end tests.

The run found two issues, both fixed and re-run before this report; see [Findings](#findings). The browser run (Playwright) is added to this report when the web app is complete.

## Environment

| Item      | Value                                                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack     | `docker compose`: the API image built from [`apps/api/Dockerfile`](../apps/api/Dockerfile) (Node 24.22.2, runs as the unprivileged `node` user, `NODE_ENV=production`), and `mongo:8.2` (MongoDB 8.2.12).       |
| Database  | `nest-react-auth-live-e2e`, dropped at the start of the run, so every document below was written by it.                                                                                                         |
| Address   | `http://127.0.0.1:3100`. The API port was published for this run only. In the normal stack, only nginx reaches the API.                                                                                         |
| Settings  | Access token 15 min. Refresh token 7 days. `TRUST_PROXY=1`. `COOKIE_SECURE=false`, because the compose stack serves plain HTTP on localhost. The production default, `true`, is checked by the automated suite. |
| Test data | Synthetic accounts on `example.com`. The passwords shown are test values.                                                                                                                                       |
| Tokens    | Never shown. Access tokens appear as `<A1>`, `<A2>`…, refresh tokens as `<R1>`, `<R2>`…, in order of first appearance. Hand-made tokens are described in angle brackets.                                        |
| Tools     | A small Node 24 script that sends each request with `fetch` and records it. The database was read with `mongosh` inside the mongo container.                                                                    |

## Requirements covered

| #   | Requirement (task spec)                                                   | Steps                               | Result                                                                                      |
| --- | ------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Sign up with email, name and password                                     | 02                                  | ✅ 201: account created, session started                                                    |
| 2   | Email must be a valid address                                             | 04                                  | ✅ 400 `Enter a valid email address`                                                        |
| 3   | Name of at least 3 characters                                             | 04                                  | ✅ 400 `Name must be at least 3 characters long`                                            |
| 4   | Password of 8+ characters with a letter, a number and a special character | 04, 05                              | ✅ each failed rule is reported on its own                                                  |
| 5   | Sign in with email and password                                           | 16–18                               | ✅ 200 for the right password, the same 401 for a wrong password or an unknown email        |
| 6   | At least one protected endpoint                                           | 08–15                               | ✅ `GET /api/v1/users/me`: 200 with a valid token, 401 for anything else                    |
| 7   | Data stored in MongoDB                                                    | [Database checks](#database-checks) | ✅                                                                                          |
| 8   | Bonus: logging                                                            | 35, 36, every error body            | ✅ every response carries `X-Request-Id`, which also appears in the logs and the error body |
| 9   | Bonus: error handling                                                     | every 4xx below                     | ✅ RFC 9457 `application/problem+json` with a stable `code`                                 |
| 10  | Bonus: API documentation                                                  | 01                                  | ✅ OpenAPI 3.0 lists all 6 paths. Swagger UI is at `/api/docs`.                             |
| 11  | Production readiness: security                                            | sections C, E, G, H                 | ✅                                                                                          |

The web app's requirements (the forms, the welcome page, sign-out) are covered by the browser run.

## Scenarios

### A. Health and API docs

| Step | Call                         | Expected                          | Got                                     |
| ---- | ---------------------------- | --------------------------------- | --------------------------------------- |
| 00   | `GET /api/health`            | 200, MongoDB up                   | ✅ 200 `{"status":"ok"}`, `mongodb: up` |
| 01   | `GET /api/docs/openapi.json` | the document, with every endpoint | ✅ 200, OpenAPI 3.0.0, 6 paths          |

### B. Sign-up

| Step | Call                                                      | Expected                          | Got                                                                                                                                              |
| ---- | --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 02   | Sign up `ada@example.com`, `Ada Lovelace`, `Analytical1!` | 201, access token, refresh cookie | ✅ 201 · user `6af38919a86f5f0be43d328f` · `expiresIn: 900` · `refresh_token=<R1>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict` |
| 03   | The same email as ` ADA@Example.com`                      | 409                               | ✅ 409 `EMAIL_ALREADY_REGISTERED`                                                                                                                |
| 04   | `not-an-email`, `Al`, `short`                             | 400, every failed rule            | ✅ 400 `VALIDATION_FAILED` with 5 errors: email; name; password (length, number, special character)                                              |
| 05   | Password `Compiler1952`                                   | 400, one rule                     | ✅ 400, only `…at least one special character…`                                                                                                  |
| 06   | An extra field, `"role": "admin"`                         | 400                               | ✅ 400 `Unrecognized key: "role"`                                                                                                                |
| 07   | `"email": {"$ne": null}`                                  | 400                               | ✅ 400 `Email must be a string`                                                                                                                  |

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

The access token's claims (step 02, signature left out): `{"alg":"HS256"}` · `{"sub":"6af38919a86f5f0be43d328f","iss":"nest-react-auth-api","aud":"nest-react-auth-web","iat":1794345241,"exp":1794346141,"jti":"187ac626-…"}`. It lives 900 seconds.

### D. Sign-in

| Step | Call                                      | Expected           | Got                                                         |
| ---- | ----------------------------------------- | ------------------ | ----------------------------------------------------------- |
| 16   | `Ada@Example.com` with the right password | 200, a new session | ✅ 200 · `<A2>` · cookie `<R2>`                             |
| 17   | Wrong password                            | 401                | ✅ 401 `INVALID_CREDENTIALS` · 36 ms                        |
| 18   | Unknown email                             | the same 401       | ✅ the same body as step 17, apart from `requestId` · 39 ms |

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

The API logged the replay at step 21 as a warning with the user ID and the request ID: `"msg":"Refresh token reuse detected; session revoked"`.

### F. Sign-out

| Step | Call                             | Expected            | Got                                  |
| ---- | -------------------------------- | ------------------- | ------------------------------------ |
| 26   | Sign out with `<R5>`             | 204, cookie cleared | ✅ 204 · `refresh_token=; Max-Age=0` |
| 27   | Refresh with `<R5>`              | 401                 | ✅ 401                               |
| 28   | Sign out again, without a cookie | 204                 | ✅ 204: safe to repeat               |

### G. Malformed requests and cross-site protection

| Step | Call                                                                | Expected                                  | Got                                                              |
| ---- | ------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| 29   | A body that is not valid JSON                                       | 400, without echoing the parser's message | ✅ 400 `MALFORMED_REQUEST` `The request body is not valid JSON.` |
| 30   | An 11 kB body (the limit is 10 kB)                                  | 413                                       | ✅ 413 `PAYLOAD_TOO_LARGE`                                       |
| 31   | A form-encoded body                                                 | 400                                       | ✅ 400 `The request body must be a JSON object`                  |
| 32   | A write with `Sec-Fetch-Site: cross-site`                           | 403                                       | ✅ 403 `FORBIDDEN`                                               |
| 33   | A write with `Origin: https://evil.example` and no `Sec-Fetch-Site` | 403                                       | ✅ 403 `FORBIDDEN`                                               |
| 34   | An unknown route                                                    | 404 problem+json                          | ✅ 404 `NOT_FOUND`                                               |
| 35   | `X-Request-Id: live-e2e-35`                                         | the ID is kept                            | ✅ `X-Request-Id: live-e2e-35`                                   |
| 36   | `X-Request-Id: two words`                                           | the ID is replaced                        | ✅ a new UUID                                                    |

Steps 29 and 30 are rejected before routing. They have their own log line (`Request rejected before routing`), so nothing goes unlogged.

### H. Rate limiting

| Step        | Call                                                 | Expected    | Got                                       |
| ----------- | ---------------------------------------------------- | ----------- | ----------------------------------------- |
| 37.01–37.10 | 10 sign-ins with a wrong password from `203.0.113.7` | 401 each    | ✅ 401 ×10                                |
| 37.11       | The 11th attempt in the same minute                  | 429         | ✅ 429 `RATE_LIMITED` · `Retry-After: 60` |
| 38          | The same request from `203.0.113.8`                  | not blocked | ✅ 401                                    |

The client address comes from `X-Forwarded-For`, because the API trusts one proxy hop (`TRUST_PROXY=1`). In the stack, that hop is nginx, which appends the real client address. A client therefore can't choose its own address. The API port was published only so this run could set the header directly.

## Database checks

**`users`, after section B:**

| `_id`                      | `email`           | `name`         | `passwordHash`                     | `createdAt`                |
| -------------------------- | ----------------- | -------------- | ---------------------------------- | -------------------------- |
| `6af38919a86f5f0be43d328f` | `ada@example.com` | `Ada Lovelace` | `$argon2id$v=19$m=19456,t=2,p=1$…` | `2026-11-10T21:14:01.972Z` |

**`refresh_tokens`, after step 20 (before the replay):**

| Token  | Session (`familyId`) | `tokenHash`   | `usedAt`                   | `expiresAt`                |
| ------ | -------------------- | ------------- | -------------------------- | -------------------------- |
| `<R1>` | `9b6da85d…`          | `B3FFN-FN3g…` | —                          | `2026-11-17T21:14:01.976Z` |
| `<R2>` | `68f7255f…`          | `qae_YWdzLn…` | `2026-11-10T21:14:02.919Z` | `2026-11-17T21:14:02.832Z` |
| `<R3>` | `68f7255f…`          | `dRKGS_HPDo…` | `2026-11-10T21:14:02.933Z` | `2026-11-17T21:14:02.923Z` |
| `<R4>` | `68f7255f…`          | `F0bHs5o0Zp…` | —                          | `2026-11-17T21:14:02.934Z` |

**`refresh_tokens`, after step 25 (after the replay):** only `<R1>` (now used) and `<R5>`, both in session `9b6da85d…`. **After step 26 (sign-out):** none.

| Check                                                  | Result                                                                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| One user, written by step 02 only                      | ✅ 1 document. Steps 03–07 wrote nothing.                                                                                                          |
| Email stored trimmed and lower-cased                   | ✅ `ada@example.com`                                                                                                                               |
| Password stored as argon2id (19 MiB, 2 passes, 1 lane) | ✅ The plain password appears nowhere in the collection.                                                                                           |
| Refresh tokens stored only as SHA-256 hashes           | ✅ No raw token appears in the collection. Each `tokenHash` matches exactly one issued token.                                                      |
| Rotation retires the old token                         | ✅ `usedAt` is set on R2 and R3.                                                                                                                   |
| A replay deletes that session only                     | ✅ R2–R4 are gone. R1's session is untouched.                                                                                                      |
| Sign-out deletes the session                           | ✅ 0 refresh tokens left.                                                                                                                          |
| Indexes                                                | ✅ `users.email` unique · `refresh_tokens.tokenHash` unique · `refresh_tokens.familyId` · `refresh_tokens.expiresAt` TTL (`expireAfterSeconds: 0`) |

## Timing

Sign-in must not reveal whether an email is registered. Each sample came from its own client address, so the rate limit stayed out of the way.

| Sign-in with     | Median  | Min     | Max     | Samples |
| ---------------- | ------- | ------- | ------- | ------- |
| A wrong password | 34.4 ms | 32.1 ms | 72.5 ms | 20      |
| An unknown email | 35.6 ms | 34.3 ms | 39.5 ms | 20      |

## Findings

Fixed in the code that this report tests:

1. **The first unknown-email sign-in after a restart was slower.** The first recording showed 65 ms for an unknown email against 35 ms for a wrong password. The throwaway hash used for unknown emails was created on first use. It is now prepared at startup ([`PasswordHasher.onModuleInit`](../apps/api/src/auth/password-hasher.ts)), with a unit test.
2. **Two access tokens issued in the same second were identical.** Steps 16, 19 and 20 returned the same JWT, because the claims were identical. Every token now carries a random `jti`, with a unit test.

Found earlier, in a manual smoke test against the same build:

- a body that was not valid JSON returned the parser's raw message and no request ID;
- the cookie's `Max-Age` was 604799 instead of 604800;
- the API docs had no examples.

All three were fixed before this run; steps 29, 02 and 01 show the results.

## Automated tests

| Suite                                                                                               | Command                                  | Result                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Shared contracts: Zod schemas and the password rules                                                | `npm test -w @nest-react-auth/contracts` | 37 passed                                                                                                        |
| API unit: services, guard, error filter, config, middleware                                         | `npm test -w @nest-react-auth/api`       | 81 passed, 100% of lines in every service                                                                        |
| API end-to-end: the real app through `createApp()`, against `mongodb-memory-server` (MongoDB 8.2.6) | `npm run test:e2e`                       | 54 passed in about 4.5 s                                                                                         |
| Lint (`oxlint --type-aware --deny-warnings`), typecheck, build, formatting                          | root `npm run …` scripts                 | clean                                                                                                            |
| Container scan (Trivy, HIGH and CRITICAL)                                                           | the API image                            | 0 findings. The stock `node:24-alpine` has 6 HIGH, all in the bundled npm and corepack, which the image removes. |

Every scenario in sections A–H is also an automated test, in [`apps/api/test`](../apps/api/test) or in the unit specs next to the code.

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
x-request-id: 6ce5c744-3c25-434f-943b-21204532c1d6
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
x-request-id: 34d849f7-44a2-40ca-8ff6-d3625d62e64a
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
  }
}
```

</details>

### B. Sign-up

<details>
<summary><code>02</code> Create an account: <code>POST /api/v1/auth/sign-up</code> → <b>201</b> · 65 ms</summary>

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

**Response** `201 Created` · 65 ms

```http
set-cookie: refresh_token=<R1>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 9ab353ad-150c-43b8-81c4-65df8fcdd0b4
```

```json
{
  "accessToken": "<A1>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af38919a86f5f0be43d328f",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-10T21:14:01.972Z"
  }
}
```

</details>

<details>
<summary><code>03</code> Same email again, upper-case and padded with spaces: <code>POST /api/v1/auth/sign-up</code> → <b>409</b> · 40 ms</summary>

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

**Response** `409 Conflict` · 40 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 6d5b29a6-25db-4387-9e1f-4582d8a801d7
```

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "An account with this email already exists.",
  "instance": "/api/v1/auth/sign-up",
  "code": "EMAIL_ALREADY_REGISTERED",
  "requestId": "6d5b29a6-25db-4387-9e1f-4582d8a801d7"
}
```

</details>

<details>
<summary><code>04</code> Every field invalid: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 5 ms</summary>

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

**Response** `400 Bad Request` · 5 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 8544aaad-f1dd-4a52-884c-64383424127c
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "8544aaad-f1dd-4a52-884c-64383424127c",
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
<summary><code>05</code> Password without a special character: <code>POST /api/v1/auth/sign-up</code> → <b>400</b> · 5 ms</summary>

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

**Response** `400 Bad Request` · 5 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: ddefa612-9f3d-4eb3-856d-f85ccc3d1878
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "ddefa612-9f3d-4eb3-856d-f85ccc3d1878",
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
x-request-id: 972467b7-a808-4cdf-9024-b4640f9fd495
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "972467b7-a808-4cdf-9024-b4640f9fd495",
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
x-request-id: 0f43134f-0bd9-4d50-b268-78c6ddb7e2f0
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-up",
  "code": "VALIDATION_FAILED",
  "requestId": "0f43134f-0bd9-4d50-b268-78c6ddb7e2f0",
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
      "_id": "6af38919a86f5f0be43d328f",
      "email": "ada@example.com",
      "name": "Ada Lovelace",
      "passwordHash": "$argon2id$v=19$m=19456,t=2,p=1$…",
      "createdAt": {
        "$date": "2026-11-10T21:14:01.972Z"
      },
      "updatedAt": {
        "$date": "2026-11-10T21:14:01.972Z"
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
x-request-id: 075be01c-c434-4e06-842b-81a1b19be370
```

```json
{
  "id": "6af38919a86f5f0be43d328f",
  "email": "ada@example.com",
  "name": "Ada Lovelace",
  "createdAt": "2026-11-10T21:14:01.972Z"
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
x-request-id: 2579f7f3-23cb-4207-8029-161b238b75c8
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Send an access token as `Authorization: Bearer <token>`.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "2579f7f3-23cb-4207-8029-161b238b75c8"
}
```

</details>

<details>
<summary><code>10</code> With a Basic header: <code>GET /api/v1/users/me</code> → <b>401</b> · 2 ms</summary>

```http
GET /api/v1/users/me
Authorization: Basic YWRhOnNlY3JldA==
```

**Response** `401 Unauthorized` · 2 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 30b5ed1c-715f-4f56-a0d0-b97069543275
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Send an access token as `Authorization: Bearer <token>`.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "30b5ed1c-715f-4f56-a0d0-b97069543275"
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
x-request-id: 5cb37430-cee3-4d62-bacb-b623c47b4906
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "5cb37430-cee3-4d62-bacb-b623c47b4906"
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
x-request-id: 2ac40128-311f-495c-916e-e75642a0909f
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "2ac40128-311f-495c-916e-e75642a0909f"
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
x-request-id: 1a3d5a17-8385-4450-8058-93beb5da5c52
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "1a3d5a17-8385-4450-8058-93beb5da5c52"
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
x-request-id: 8b3698a4-afde-413a-91f1-f62bf43730e3
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "8b3698a4-afde-413a-91f1-f62bf43730e3"
}
```

</details>

<details>
<summary><code>15</code> The refresh token used as a bearer token: <code>GET /api/v1/users/me</code> → <b>401</b> · 3 ms</summary>

```http
GET /api/v1/users/me
Authorization: Bearer <R1>
```

**Response** `401 Unauthorized` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
www-authenticate: Bearer
x-request-id: 172a4285-fce7-4151-87a5-e89e5db2d2bf
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The access token is invalid or has expired.",
  "instance": "/api/v1/users/me",
  "code": "UNAUTHORIZED",
  "requestId": "172a4285-fce7-4151-87a5-e89e5db2d2bf"
}
```

</details>

### D. Sign-in

<details>
<summary><code>16</code> Correct password, email in another letter case: <code>POST /api/v1/auth/sign-in</code> → <b>200</b> · 41 ms</summary>

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

**Response** `200 OK` · 41 ms

```http
set-cookie: refresh_token=<R2>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 54b73e3c-e3b2-4745-a2bb-df96d1390475
```

```json
{
  "accessToken": "<A2>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af38919a86f5f0be43d328f",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-10T21:14:01.972Z"
  }
}
```

</details>

<details>
<summary><code>17</code> Wrong password: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 36 ms</summary>

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

**Response** `401 Unauthorized` · 36 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: ea91256c-4fe2-4eca-b2b9-2eee868e5151
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "ea91256c-4fe2-4eca-b2b9-2eee868e5151"
}
```

</details>

<details>
<summary><code>18</code> Unknown email: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 39 ms</summary>

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

**Response** `401 Unauthorized` · 39 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 01381337-a6a2-4824-aaaa-c7b31c9f29fd
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "01381337-a6a2-4824-aaaa-c7b31c9f29fd"
}
```

</details>

### E. Refresh: rotation and reuse detection

<details>
<summary><code>19</code> Refresh with R2 (from step 16): <code>POST /api/v1/auth/refresh</code> → <b>200</b> · 14 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R2>
```

**Response** `200 OK` · 14 ms

```http
set-cookie: refresh_token=<R3>; Path=/api/v1/auth; Max-Age=604800; HttpOnly; SameSite=Strict
content-type: application/json; charset=utf-8
x-request-id: 9a1c0dbc-7c84-4d4e-a04f-c44693822ec1
```

```json
{
  "accessToken": "<A3>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af38919a86f5f0be43d328f",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-10T21:14:01.972Z"
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
x-request-id: 4cd2dce6-39a8-4503-85d1-f29d68911681
```

```json
{
  "accessToken": "<A4>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af38919a86f5f0be43d328f",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-10T21:14:01.972Z"
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
      "family": "9b6da85d",
      "tokenHash": "B3FFN-FN3g…",
      "usedAt": null,
      "expiresAt": {
        "$date": "2026-11-17T21:14:01.976Z"
      }
    },
    {
      "token": "<R2>",
      "family": "68f7255f",
      "tokenHash": "qae_YWdzLn…",
      "usedAt": {
        "$date": "2026-11-10T21:14:02.919Z"
      },
      "expiresAt": {
        "$date": "2026-11-17T21:14:02.832Z"
      }
    },
    {
      "token": "<R3>",
      "family": "68f7255f",
      "tokenHash": "dRKGS_HPDo…",
      "usedAt": {
        "$date": "2026-11-10T21:14:02.933Z"
      },
      "expiresAt": {
        "$date": "2026-11-17T21:14:02.923Z"
      }
    },
    {
      "token": "<R4>",
      "family": "68f7255f",
      "tokenHash": "F0bHs5o0Zp…",
      "usedAt": null,
      "expiresAt": {
        "$date": "2026-11-17T21:14:02.934Z"
      }
    }
  ],
  "rawTokenStored": false
}
```

</details>

<details>
<summary><code>21</code> Replay R2, which was already used: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 8 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R2>
```

**Response** `401 Unauthorized` · 8 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
x-request-id: b389f9d3-06b2-4688-8676-e6dc32beeb6b
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "b389f9d3-06b2-4688-8676-e6dc32beeb6b"
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
x-request-id: 2437ebd8-36fd-41a8-89b3-c011ad9bb088
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "2437ebd8-36fd-41a8-89b3-c011ad9bb088"
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
x-request-id: b52c4a16-34c6-4511-8e74-f4b1bfc3b583
```

```json
{
  "accessToken": "<A5>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "6af38919a86f5f0be43d328f",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "createdAt": "2026-11-10T21:14:01.972Z"
  }
}
```

</details>

<details>
<summary><code>24</code> Refresh without a cookie: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 3 ms</summary>

```http
POST /api/v1/auth/refresh
```

**Response** `401 Unauthorized` · 3 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
x-request-id: a5a601d1-7f2a-4258-98af-e5aacddae1fc
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "a5a601d1-7f2a-4258-98af-e5aacddae1fc"
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
x-request-id: 887ab0be-3842-40d0-bf3d-dfb0e9a131b0
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "887ab0be-3842-40d0-bf3d-dfb0e9a131b0"
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
      "family": "9b6da85d",
      "usedAt": {
        "$date": "2026-11-10T21:14:03.748Z"
      }
    },
    {
      "token": "<R5>",
      "family": "9b6da85d",
      "usedAt": null
    }
  ]
}
```

</details>

### F. Sign-out

<details>
<summary><code>26</code> Sign out with R5: <code>POST /api/v1/auth/sign-out</code> → <b>204</b> · 5 ms</summary>

```http
POST /api/v1/auth/sign-out
Cookie: refresh_token=<R5>
```

**Response** `204 No Content` · 5 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
x-request-id: 35fdbb59-b67c-4025-bf05-f8fc6c4296d0
```

</details>

<details>
<summary><code>27</code> Refresh with R5 after sign-out: <code>POST /api/v1/auth/refresh</code> → <b>401</b> · 5 ms</summary>

```http
POST /api/v1/auth/refresh
Cookie: refresh_token=<R5>
```

**Response** `401 Unauthorized` · 5 ms

```http
set-cookie: refresh_token=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Strict
content-type: application/problem+json; charset=utf-8
x-request-id: b6408319-7079-4495-83ca-12df7205f25f
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Your session has ended. Please sign in again.",
  "instance": "/api/v1/auth/refresh",
  "code": "INVALID_REFRESH_TOKEN",
  "requestId": "b6408319-7079-4495-83ca-12df7205f25f"
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
x-request-id: 250de290-fa7e-40cd-ba5e-a458a0429e98
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
<summary><code>29</code> Body that is not valid JSON: <code>POST /api/v1/auth/sign-in</code> → <b>400</b> · 5 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/json
```

```text
{"email": "ada@example.com",
```

**Response** `400 Bad Request` · 5 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 30bbd483-ba1b-48ff-9579-999968b86f49
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request body is not valid JSON.",
  "instance": "/api/v1/auth/sign-in",
  "code": "MALFORMED_REQUEST",
  "requestId": "30bbd483-ba1b-48ff-9579-999968b86f49"
}
```

</details>

<details>
<summary><code>30</code> Body over 10 kB: <code>POST /api/v1/auth/sign-up</code> → <b>413</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-up
Content-Type: application/json
```

```text
{"email":"big@example.com","name":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx… (11327 characters)
```

**Response** `413 Payload Too Large` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 74e53d95-671f-425b-8a6e-e2fb746dd83f
```

```json
{
  "type": "about:blank",
  "title": "Payload Too Large",
  "status": 413,
  "detail": "The request body is too large.",
  "instance": "/api/v1/auth/sign-up",
  "code": "PAYLOAD_TOO_LARGE",
  "requestId": "74e53d95-671f-425b-8a6e-e2fb746dd83f"
}
```

</details>

<details>
<summary><code>31</code> Form-encoded body instead of JSON: <code>POST /api/v1/auth/sign-in</code> → <b>400</b> · 3 ms</summary>

```http
POST /api/v1/auth/sign-in
Content-Type: application/x-www-form-urlencoded
```

```text
email=ada%40example.com&password=Analytical1!
```

**Response** `400 Bad Request` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: efe3782a-181c-49e5-ac2b-13eb8d52eb62
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "The request is invalid. See `errors` for each field.",
  "instance": "/api/v1/auth/sign-in",
  "code": "VALIDATION_FAILED",
  "requestId": "efe3782a-181c-49e5-ac2b-13eb8d52eb62",
  "errors": [
    {
      "message": "The request body must be a JSON object"
    }
  ]
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
x-request-id: 4ae36422-fb25-4fda-a810-e7139a899723
```

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "Cross-origin request detected from Sec-Fetch-Site header",
  "instance": "/api/v1/auth/sign-out",
  "code": "FORBIDDEN",
  "requestId": "4ae36422-fb25-4fda-a810-e7139a899723"
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
x-request-id: faa73c89-eaa5-4319-990d-cde02c1fd3f1
```

```json
{
  "type": "about:blank",
  "title": "Forbidden",
  "status": 403,
  "detail": "Cross-origin request detected, and/or browser is out of date: Sec-Fetch-Site is missing, and Origin does not match Host",
  "instance": "/api/v1/auth/sign-in",
  "code": "FORBIDDEN",
  "requestId": "faa73c89-eaa5-4319-990d-cde02c1fd3f1"
}
```

</details>

<details>
<summary><code>34</code> Unknown route: <code>GET /api/v1/nope</code> → <b>404</b> · 3 ms</summary>

```http
GET /api/v1/nope
```

**Response** `404 Not Found` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: cbca774d-c337-4edd-a504-ebf3bcaec9b1
```

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "Cannot GET /api/v1/nope",
  "instance": "/api/v1/nope",
  "code": "NOT_FOUND",
  "requestId": "cbca774d-c337-4edd-a504-ebf3bcaec9b1"
}
```

</details>

<details>
<summary><code>35</code> Caller's request ID is kept: <code>GET /api/health</code> → <b>200</b> · 4 ms</summary>

```http
GET /api/health
X-Request-Id: live-e2e-35
```

**Response** `200 OK` · 4 ms · trimmed to the parts that matter

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
<summary><code>36</code> Unsafe request ID is replaced: <code>GET /api/health</code> → <b>200</b> · 4 ms</summary>

```http
GET /api/health
X-Request-Id: two words
```

**Response** `200 OK` · 4 ms · trimmed to the parts that matter

```http
content-type: application/json; charset=utf-8
x-request-id: 580141ae-9b53-450f-9514-48efff033e6b
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
<summary><code>37.01</code> Attempt 1 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 35 ms</summary>

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

**Response** `401 Unauthorized` · 35 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: c2f83ba2-fc2c-43b3-b828-aa18568a28e4
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "c2f83ba2-fc2c-43b3-b828-aa18568a28e4"
}
```

</details>

<details>
<summary><code>37.02</code> Attempt 2 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 35 ms</summary>

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

**Response** `401 Unauthorized` · 35 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 14da6347-252a-4583-ba42-3d6113c9e3c3
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "14da6347-252a-4583-ba42-3d6113c9e3c3"
}
```

</details>

<details>
<summary><code>37.03</code> Attempt 3 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 37 ms</summary>

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

**Response** `401 Unauthorized` · 37 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 59a3314f-1b61-4a65-b064-4d4957f68a9e
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "59a3314f-1b61-4a65-b064-4d4957f68a9e"
}
```

</details>

<details>
<summary><code>37.04</code> Attempt 4 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 35 ms</summary>

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

**Response** `401 Unauthorized` · 35 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: cc75cc84-5689-4da3-b35b-10c53623e03b
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "cc75cc84-5689-4da3-b35b-10c53623e03b"
}
```

</details>

<details>
<summary><code>37.05</code> Attempt 5 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 38 ms</summary>

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

**Response** `401 Unauthorized` · 38 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 0c51e52a-fa72-49fd-a1ff-881246e7445e
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "0c51e52a-fa72-49fd-a1ff-881246e7445e"
}
```

</details>

<details>
<summary><code>37.06</code> Attempt 6 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 37 ms</summary>

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

**Response** `401 Unauthorized` · 37 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 651666ee-cef6-48fb-bc62-937280931a53
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "651666ee-cef6-48fb-bc62-937280931a53"
}
```

</details>

<details>
<summary><code>37.07</code> Attempt 7 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 38 ms</summary>

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

**Response** `401 Unauthorized` · 38 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 17d5c503-90ce-418a-a7a3-61b18a534542
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "17d5c503-90ce-418a-a7a3-61b18a534542"
}
```

</details>

<details>
<summary><code>37.08</code> Attempt 8 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 37 ms</summary>

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

**Response** `401 Unauthorized` · 37 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: b1dcd88c-749d-48a8-9399-960440151c0d
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "b1dcd88c-749d-48a8-9399-960440151c0d"
}
```

</details>

<details>
<summary><code>37.09</code> Attempt 9 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 42 ms</summary>

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

**Response** `401 Unauthorized` · 42 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: d47e688a-592f-4411-a92d-32e986b9b69b
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "d47e688a-592f-4411-a92d-32e986b9b69b"
}
```

</details>

<details>
<summary><code>37.10</code> Attempt 10 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 37 ms</summary>

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

**Response** `401 Unauthorized` · 37 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 09a2c3ea-2e22-43cb-a65e-1840508c3bc4
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "09a2c3ea-2e22-43cb-a65e-1840508c3bc4"
}
```

</details>

<details>
<summary><code>37.11</code> Attempt 11 from 203.0.113.7: <code>POST /api/v1/auth/sign-in</code> → <b>429</b> · 3 ms</summary>

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

**Response** `429 Too Many Requests` · 3 ms

```http
content-type: application/problem+json; charset=utf-8
retry-after: 60
x-request-id: 6e76715b-b8df-4452-87d1-eabeb09f2a18
```

```json
{
  "type": "about:blank",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "Too many requests. Please wait a minute and try again.",
  "instance": "/api/v1/auth/sign-in",
  "code": "RATE_LIMITED",
  "requestId": "6e76715b-b8df-4452-87d1-eabeb09f2a18"
}
```

</details>

<details>
<summary><code>38</code> Same request from another client (203.0.113.8): <code>POST /api/v1/auth/sign-in</code> → <b>401</b> · 39 ms</summary>

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

**Response** `401 Unauthorized` · 39 ms

```http
content-type: application/problem+json; charset=utf-8
x-request-id: 25381ef7-c605-4800-95ba-518630feffb2
```

```json
{
  "type": "about:blank",
  "title": "Unauthorized",
  "status": 401,
  "detail": "The email or password is incorrect.",
  "instance": "/api/v1/auth/sign-in",
  "code": "INVALID_CREDENTIALS",
  "requestId": "25381ef7-c605-4800-95ba-518630feffb2"
}
```

</details>

<details>
<summary>Final DB state (mongosh)</summary>

```json
{
  "users": 1,
  "refresh_tokens": 0,
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

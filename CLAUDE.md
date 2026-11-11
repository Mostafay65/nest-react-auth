# CLAUDE.md

Rules for AI coding agents in this repo. The reasons behind them are in `docs/ARCHITECTURE.md`.

## Map

- `packages/contracts`: Zod schemas, password rules and error codes, shared by the API and the web app. `npm ci` builds it (postinstall), and `npm run dev` rebuilds it on change.
- `apps/api`: NestJS 12 (ESM, `nodenext`, so relative imports end in `.js`) with Mongoose. It has `src/auth`, `src/users`, `src/health`, `src/config/env.ts` and `src/common` (errors, validation, logging, HTTP, Swagger). Unit tests live next to the code (`*.spec.ts`), end-to-end tests in `test/*.e2e-spec.ts`.
- `apps/web`: React 19, Vite 8, React Router 8. It has `src/app` (routes, frame), `src/features`, `src/pages` and `src/shared` (HTTP client, styles, UI).
- `e2e`: Playwright tests against the Docker stack.

## Commands

Node 24 (`.nvmrc`). From the repo root:

- `npm run dev`: the API on :3000 and the web app on :5173. It needs `npm run db:up` (MongoDB only) and `apps/api/.env` (copy `.env.example`).
- `npm run stack:up` / `npm run stack:down`: the whole stack, built from source, on :8080.
- `npm run format:check`, `lint`, `typecheck`, `test` (contracts, API unit and web), `test:e2e` (API), `test:browser`, `build`.
- One workspace: `npm run <script> -w @nest-react-auth/<contracts|api|web|e2e>`.
- One test file, run from inside the workspace: `npx vitest run <path>`. For API end-to-end files, add `--config ./vitest.config.e2e.ts`.

## API rules

- Controllers handle HTTP only: bodies, cookies, status codes and Swagger decorators. Services hold the rules.
- Services depend on abstract repository classes, which double as DI tokens and are bound in the module (`{ provide: UsersRepository, useClass: MongooseUsersRepository }`).
- Only `Mongoose*Repository` classes import Mongoose. They return plain objects (`User`, `StoredRefreshToken`), never documents.
- Services throw `AppError` subclasses (`src/common/errors/app-error.ts`) with a code from `ERROR_CODES` in contracts. They never throw `HttpException`. To add a code:
  1. add it to `packages/contracts/src/errors.ts`;
  2. map it in `STATUS_BY_CODE` in `src/common/errors/problem-details.filter.ts`.
- Every route goes through the global `AccessTokenGuard`. Mark public routes with `@Public()`, and read the caller with `@CurrentUser()`.
- Validate input with `@Body({ schema })` and a contract schema, through the global `StandardSchemaValidationPipe`. No class-validator DTOs.
- To add a setting:
  1. add it to `envSchema` in `src/config/env.ts` and to `apps/api/.env.example`;
  2. read it with `ConfigService<Env, true>` and `{ infer: true }`.
- Never log tokens, passwords, hashes or headers. Log IDs (`userId`, `familyId`) instead.
- Document every new route: `@ApiProblemResponse(status, …)` for each error it can return, and `standardSchema` for each success body.

## Web rules

- The session lives in memory (`features/auth/session-store.ts`). Tokens never go to `localStorage` or `sessionStorage`.
- Call the API through `shared/http/request.ts`, or `authorizedJson` for protected routes (it refreshes once on a 401). Check every response with a contract schema.
- Refresh only through `refreshSession()`. It runs one refresh at a time and takes a Web Lock across tabs. A second, parallel refresh would trip reuse detection and end the session.
- Guards are route middleware (`features/auth/guards.ts`, `app/routes.tsx`), not effects.
- Handle server errors by `code` (`features/auth/form-errors.ts`), never by message text.
- Style with CSS Modules and the variables in `shared/styles/tokens.css`:
  - Add colours only in `tokens.css`, for both themes, and keep `tokens.test.ts` (WCAG AA) passing.
  - No UI kits, no `<style>` tags, no CDN assets: nginx sends `script-src 'self'`, `style-src 'self'` and `font-src 'self'`.
- Accessibility:
  - Fields go through `TextField`, which gives each one a real label, plus `aria-invalid` and `aria-describedby` on errors.
  - On a failed submit, focus moves to the first problem; form-level errors use `role="alert"`.
  - Every page sets its `<title>`, and its `h1` has `tabIndex={-1}`, because the frame moves focus there on navigation.
  - Motion only runs under `prefers-reduced-motion: no-preference`.

## Testing rules

- API unit tests build services by hand, with the in-memory fakes in `apps/api/test/fakes` and `createTestConfig()`. There is no Nest container and no database.
- API end-to-end tests start the real app with `startTestApp()` (`apps/api/test/support/e2e.ts`): the same `createApp()` as `main.ts`, against mongodb-memory-server, with one database per file. Send requests through `apiClient(app)`; each client has its own IP, so rate limits don't carry over between tests.
- Web tests use Testing Library, with MSW for the API (`src/test/api.ts`). A test fails on any `console.warn` or `console.error`, and on any request to an endpoint it didn't declare.
- Every fix needs a test that failed before it.
- Before committing, run `npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e`.

## Conventions

- Conventional commits: `feat(web): …`, `fix(api): …`, `docs: …`, `ci: …`. Husky runs Prettier on staged files. Never skip hooks.
- Prettier settings: single quotes, trailing commas, a width of 100.
- Several dependencies are newer than most models' training data: Nest 12, React Router 8, Vite 8, Zod 4, Vitest 5 and TypeScript 6. Check current docs before relying on memory. NestJS publishes docs for LLMs at https://docs.nestjs.com/llms.txt.

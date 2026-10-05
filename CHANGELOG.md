# Changelog

All notable changes to `@montek/sdk`. The format follows [Keep a Changelog](https://keepachangelog.com/),
and versions follow [Semantic Versioning](https://semver.org/) with the major version tracking the API's (`/v1` → `1.x`).

## [Unreleased]

### Added

- `new Montek({ apiKey })`, falling back to `MONTEK_API_KEY`; live keys are refused in browsers.
- `extract()` from a path, bytes, Blob/File or URL.
- `cad.create()` / `cad.get()` returning a job with `wait()`, and `cad.getPart()` for the DXF of a part.
- `verifyWebhook()` for the HMAC-signed `Montek-Signature` header of `cad.succeeded` / `cad.failed`.
- `usage.get()`, `models.list()` and `me()`.
- Typed errors, retries with backoff honouring `Retry-After`, automatic `Idempotency-Key` on POST.
- Types generated from montek-api's `openapi.yaml`.

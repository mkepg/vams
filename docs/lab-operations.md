# VAMS Lab operations

How the Lab's compile service is set up and kept running: what exists on Cloudflare and Google Cloud, the one step only the owner can take, the scripts that do the rest, and what to do when the secret has to change or billing has been switched off.

The design is in [specs/2026-10-28-vams-lab-design.md](specs/2026-10-28-vams-lab-design.md). In short, the page posts a student's file to the Pages Function `/api/compile`. The function caps it at 200 KB, adds the shared secret and the client's IP, and forwards it to the Cloud Run service `lab-compile`. The service counts every compile in Firestore and rests at 80% of the month's free allowance. A $1 budget is the last stop: if it is ever reached, the billing guard unlinks the project's billing account and the Lab goes offline.

## What exists where

### Cloudflare (Pages project `vams`)

| Thing | Name | Where it is set |
| --- | --- | --- |
| KV namespace | `SHARES`, id `7d85439fec8247699fb6cbef54207f94` | `wrangler.toml` |
| KV namespace | `LAB_RUNTIME`, id `03554bbf6ea4458bba35732e7e1f43db`: the main module under `<version>/<file>` | `wrangler.toml` |
| Variable | `LAB_COMPILE_URL`: the Cloud Run service's base URL. While it is empty, `/api/compile` answers `503 { offline: true }` | `wrangler.toml` `[vars]` |
| Secret | `LAB_COMPILE_SECRET`: the same value as `lab-secret` in Secret Manager | `npx wrangler pages secret put` |
| Functions | `/api/compile` (`functions/api/compile.ts`), `/lab-runtime/<version>/<file>` (`functions/lab-runtime/[[path]].ts`) | the repository |

`wrangler.toml` is the configuration source, and its `[vars]` override anything typed into the dashboard, so the URL is changed in the file and committed.

### Google Cloud (region `us-central1`)

| Thing | Name |
| --- | --- |
| Project | `vams-lab`, or the first free `vams-lab-N`, labelled `vams=lab` (see Recorded values) |
| Billing | the owner's single open billing account, linked to the project |
| Cloud Run service | `lab-compile`: 3 instances at most, 0 at least, 2 compiles an instance, 2 vCPUs, 2 GiB, a 30 s timeout. It takes unauthenticated requests; the `X-Lab-Secret` header is the gate |
| Its environment | `GOOGLE_CLOUD_PROJECT` (without it the service counts in memory, per instance), `LAB_SECRET` from Secret Manager |
| Its service account | `lab-compile@<project>.iam.gserviceaccount.com`: `roles/datastore.user` on the project, `roles/secretmanager.secretAccessor` on `lab-secret` |
| Image | Artifact Registry `lab` (docker), image `compile:<commit>`, built from `lab/toolchain/Dockerfile`. A cleanup policy keeps the two newest, inside the free 0.5 GB |
| Firestore | `(default)`, Native mode. `usage/<yyyy-mm>` holds the month's totals and each day's compiles; `rate/<visitor>` and `rate/ip-<sha256>` hold the rate windows, which a TTL policy on `expires` deletes |
| Secret | `lab-secret` in Secret Manager: 64 hex characters from `openssl rand -hex 32` |
| Pub/Sub topic | `budget` |
| Budget | `vams-lab`: $1 (or its equivalent in the account's currency) on this project, alerts at 50%, 90% and 100%, published to `budget` |
| Billing guard | Cloud Run function `billing-guard` (gen2, Node 22, entry point `onBudget`), triggered by `budget`, with retries. Its source is `lab/billing-guard/index.ts` with the types stripped. It runs as `billing-guard@<project>.iam.gserviceaccount.com`, which has `roles/billing.projectManager` on the project and may invoke the function |

### Recorded values

Filled in from the summary `setup-gcp.sh` prints at the end.

| What | Value |
| --- | --- |
| Project | |
| Region | `us-central1` |
| Billing account | |
| Service URL | |
| Image | |
| Compile service account | |
| Guard service account | |
| Budget | |
| Runtime version | |

## The owner's step

This is the only part that needs the owner, and it comes before anything else:

1. Create a Google Cloud billing account at <https://console.cloud.google.com/billing> and add the card.
2. Install the Google Cloud CLI if `gcloud --version` doesn't answer: <https://cloud.google.com/sdk/docs/install>.
3. Sign in with `gcloud auth login`.

Nothing else is asked of the owner. The scripts below never change the card, and the budget guard only ever removes the billing link.

## Setting up

Run from the repository root in Git Bash (Windows) or any POSIX shell, with Docker running and `npx wrangler` signed in to the Cloudflare account (`npx wrangler whoami`).

1. **Google Cloud and the Pages secret.** `bash scripts/lab/setup-gcp.sh`

   It creates or finds everything in the table above, in order: the project, the billing link, the APIs, the two service accounts and their roles, Artifact Registry, Firestore, the secret, the image (built locally and pushed), the Cloud Run service, the topic, the budget and the guard. It then stores the secret in Pages as `LAB_COMPILE_SECRET` and writes the service URL into `wrangler.toml`. Run again, it changes only what is missing, and it deploys a new revision and a new guard build.

   It stops with a message when there is more than one open billing account (set `BILLING_ACCOUNT=<id>`), and when the account bills in a currency other than US dollars (set `BUDGET_AMOUNT`, for example `BUDGET_AMOUNT=60PHP`). `PROJECT=<id>` picks the project id.

   Afterwards it checks that the service has the limits above and that a request without the secret gets 401. Copy the printed summary into Recorded values, and commit `wrangler.toml`.

2. **The main module.** `node scripts/lab/publish-runtime.mjs`

   It builds `lab/runtime/build.sh` in the pinned `emscripten/emsdk` image into `lab/runtime/out/publish/`, uploads every file to `LAB_RUNTIME` as `<EMSDK_VERSION>-<sha8>/<file>`, and writes that version into `src/features/lab-run/model/runtime-version.ts`. Commit that file. `--dry-run` builds and prints the keys without uploading or writing anything. A version is the hash of its files, so publishing an unchanged build again uploads the same keys.

3. **Deploy the site** (push to `main`), so Pages picks up `wrangler.toml` and the new version. Then `curl -I https://vams.pages.dev/lab-runtime/<version>/vams_main.wasm` answers 200 with `cache-control: public, max-age=31536000, immutable`.

4. **The live checks.** `node --experimental-strip-types scripts/lab/load-test.mjs --project <project> --record`

   It reads the URL and the secret with `gcloud`, runs SEC-LAB-04 to SEC-LAB-10 and adds a row for each to the table below. Add `--site https://vams.pages.dev` to send SEC-LAB-09 through the site, so its 40 compiles come from this machine's IP. `--only SEC-LAB-07` runs one check. SEC-LAB-07 raises the month's counter to 80% and lowers it again afterwards, even when the check fails; the instance that answered keeps resting for up to 60 s. SEC-LAB-10 runs the guard in the script's own process with a stand-in for Google, so it never reaches real billing.

## Rotating the secret

The secret is in three places: Secret Manager, the Cloud Run revision, and Pages. Between the second and third steps, compiles get 401 and the Lab shows offline, so rotate when nobody is using it.

```bash
P=<project>
openssl rand -hex 32 | tr -d '\r\n' | gcloud secrets versions add lab-secret --project=$P --data-file=-
gcloud run services update lab-compile --region=us-central1 --project=$P --update-secrets=LAB_SECRET=lab-secret:latest
gcloud secrets versions access latest --secret=lab-secret --project=$P | npx wrangler pages secret put LAB_COMPILE_SECRET --project-name vams
```

Six active secret versions are free. Destroy the old one once the new one works: `gcloud secrets versions list lab-secret --project=$P`, then `gcloud secrets versions destroy <n> --secret=lab-secret --project=$P`.

## Turning billing back on

When the budget is reached, the guard unlinks the billing account. Cloud Run, Firestore and the function stop, and the Lab shows offline. The guard's log says `Billing turned off for <project>.`

1. Find out why in the Billing reports (<https://console.cloud.google.com/billing>) and the logs below.
2. Link the account again: `gcloud billing projects link <project> --billing-account=<id>`, or run `setup-gcp.sh`, which does the same.
3. The budget counts the whole month. If the month's cost is still at or over the budget, the next budget message turns billing off again, so raise the budget first or wait for the 1st: `gcloud billing budgets list --billing-account=<id>`, then `gcloud billing budgets update <budget> --billing-account=<id> --budget-amount=<amount>`.

## Reading the logs

```bash
P=<project>
gcloud run services logs read lab-compile --region=us-central1 --project=$P --limit=100
gcloud functions logs read billing-guard --region=us-central1 --project=$P --gen2 --limit=50
```

The compile service logs one line when it starts (`compile service on :8080, counting in Firestore (<project>)`), `compile request failed: <message>` for a request that ended in 500, and `settle failed: <message>` when a compile couldn't be counted. It never logs a student's source or a stack. A start line that says `counting in memory` means `GOOGLE_CLOUD_PROJECT` is missing from the service.

The month's usage is the document `usage/<yyyy-mm>` in the Firestore console (<https://console.cloud.google.com/firestore>).

## Live checks

`scripts/lab/load-test.mjs --record` adds a row per check.

| Check | Result | Detail | Run |
| --- | --- | --- | --- |

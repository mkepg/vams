#!/usr/bin/env bash
# Sets up the Lab's compile service on Google Cloud and connects the site to it.
# It is safe to run again: every step checks what exists before it creates.
#
#   bash scripts/lab/setup-gcp.sh
#
# Needs: gcloud signed in (gcloud auth login), docker, node 22.13 or later,
# openssl, and npx wrangler signed in to the Cloudflare account that owns the
# Pages project vams. See docs/lab-operations.md.
#
# Optional settings, as environment variables:
#   PROJECT          use this project id (created if missing) instead of the
#                    one labelled vams=lab, or the first free vams-lab[-N]
#   BILLING_ACCOUNT  the billing account id, when there is more than one
#   BUDGET_AMOUNT    the budget, as gcloud writes it (default 1USD); needed when
#                    the billing account bills in another currency, e.g. 60PHP
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
# gcloud never waits for an answer: a question it would ask fails the step instead.
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

REGION=us-central1
SERVICE=lab-compile
REPOSITORY=lab
SECRET=lab-secret
TOPIC=budget
GUARD=billing-guard
BUDGET_NAME=vams-lab
LABEL=vams=lab

say() { printf '\n== %s\n' "$*"; }
die() { printf 'setup-gcp: %s\n' "$*" >&2; exit 1; }
# A path as Windows tools want it (C:/...) under Git Bash, unchanged elsewhere.
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }
# IAM changes to a service account made seconds ago can fail until it propagates.
retry() {
  local n
  for n in 1 2 3 4 5 6; do
    if "$@"; then return 0; fi
    [ "$n" = 6 ] && return 1
    echo "retrying in 10 s: $*" >&2
    sleep 10
  done
}

for tool in gcloud docker node openssl npx git curl; do
  command -v "$tool" >/dev/null 2>&1 || die "$tool is not installed"
done
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n 1)
[ -n "$ACCOUNT" ] || die "no Google account is signed in: run gcloud auth login"
echo "signed in as $ACCOUNT"

say "Billing account"
if [ -z "${BILLING_ACCOUNT:-}" ]; then
  ACCOUNTS=$(gcloud billing accounts list --filter=open=true --format='value(name)')
  COUNT=$(printf '%s\n' "$ACCOUNTS" | grep -c . || true)
  [ "$COUNT" = 1 ] || die "found $COUNT open billing accounts; set BILLING_ACCOUNT to the one to use (gcloud billing accounts list)"
  BILLING_ACCOUNT=$ACCOUNTS
fi
BILLING_ACCOUNT=${BILLING_ACCOUNT#billingAccounts/}
echo "billing account $BILLING_ACCOUNT"

say "Project"
if [ -z "${PROJECT:-}" ]; then
  PROJECT=$(gcloud projects list --filter="labels.${LABEL%%=*}=${LABEL#*=}" --format='value(projectId)' --limit=1)
fi
if [ -n "$PROJECT" ]; then
  if ! gcloud projects describe "$PROJECT" >/dev/null 2>&1; then
    gcloud projects create "$PROJECT" --name="VAMS Lab" --labels="$LABEL"
  fi
else
  # Project ids are global, so vams-lab may belong to someone else.
  LAST=""
  for CANDIDATE in vams-lab vams-lab-2 vams-lab-3 vams-lab-4 vams-lab-5 vams-lab-6 vams-lab-7 vams-lab-8 vams-lab-9; do
    if LAST=$(gcloud projects create "$CANDIDATE" --name="VAMS Lab" --labels="$LABEL" 2>&1); then
      PROJECT=$CANDIDATE
      break
    fi
  done
  [ -n "$PROJECT" ] || die "could not create a project; the last answer was: $LAST"
fi
echo "project $PROJECT"
g() { gcloud --project="$PROJECT" --quiet "$@"; }

ENABLED=$(gcloud billing projects describe "$PROJECT" --format='value(billingEnabled)')
case "$ENABLED" in
  [Tt]rue) echo "billing is on" ;;
  *) gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT" ;;
esac

say "APIs"
g services enable \
  run.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com \
  cloudbilling.googleapis.com billingbudgets.googleapis.com pubsub.googleapis.com \
  cloudfunctions.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com eventarc.googleapis.com iam.googleapis.com

say "Service accounts"
RUN_SA=$SERVICE@$PROJECT.iam.gserviceaccount.com
GUARD_SA=$GUARD@$PROJECT.iam.gserviceaccount.com
g iam service-accounts describe "$RUN_SA" >/dev/null 2>&1 \
  || g iam service-accounts create "$SERVICE" --display-name="VAMS Lab compile service"
g iam service-accounts describe "$GUARD_SA" >/dev/null 2>&1 \
  || g iam service-accounts create "$GUARD" --display-name="VAMS Lab billing guard"
# The compile service counts in Firestore; the guard may unlink the project's billing.
retry g projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$RUN_SA" \
  --role=roles/datastore.user --condition=None >/dev/null
retry g projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$GUARD_SA" \
  --role=roles/billing.projectManager --condition=None >/dev/null
echo "$RUN_SA: roles/datastore.user"
echo "$GUARD_SA: roles/billing.projectManager"

say "Artifact Registry"
if ! g artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1; then
  g artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION" \
    --description="VAMS Lab compile service images"
fi
# Keep the two newest images, so storage stays inside the free 0.5 GB.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cat > "$WORK/cleanup.json" <<'EOF'
[
  { "name": "keep-newest", "action": { "type": "Keep" }, "mostRecentVersions": { "keepCount": 2 } },
  { "name": "delete-older", "action": { "type": "Delete" }, "condition": { "tagState": "ANY" } }
]
EOF
g artifacts repositories set-cleanup-policies "$REPOSITORY" --location="$REGION" \
  --policy="$(native "$WORK/cleanup.json")" --no-dry-run >/dev/null

say "Firestore"
if ! g firestore databases describe --database='(default)' >/dev/null 2>&1; then
  g firestore databases create --location="$REGION" --type=firestore-native
fi
# Rate windows carry an `expires` time; Firestore deletes them once it passes.
if ! g firestore fields ttls list --format='value(name)' 2>/dev/null | grep -q '/collectionGroups/rate/fields/expires$'; then
  g firestore fields ttls update expires --collection-group=rate --enable-ttl --async
fi

say "Secret"
if ! g secrets describe "$SECRET" >/dev/null 2>&1; then
  openssl rand -hex 32 | tr -d '\r\n' | g secrets create "$SECRET" --replication-policy=automatic --data-file=-
fi
retry g secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:$RUN_SA" \
  --role=roles/secretmanager.secretAccessor --condition=None >/dev/null
echo "$RUN_SA: roles/secretmanager.secretAccessor on $SECRET"

say "Image"
EMSDK_VERSION=$(tr -d '\r\n' < lab/toolchain/EMSDK_VERSION)
TAG=$(git rev-parse --short=12 HEAD)
if [ -n "$(git status --porcelain -- lab)" ]; then TAG=$TAG-dirty-$(date +%s); fi
IMAGE=$REGION-docker.pkg.dev/$PROJECT/$REPOSITORY/compile:$TAG
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet >/dev/null
docker build -f lab/toolchain/Dockerfile --build-arg EMSDK_VERSION="$EMSDK_VERSION" -t "$IMAGE" .
docker push "$IMAGE"

say "Cloud Run service $SERVICE"
# Unauthenticated requests reach the service; the X-Lab-Secret header is the gate.
g run deploy "$SERVICE" --image="$IMAGE" --region="$REGION" --service-account="$RUN_SA" \
  --max-instances 3 --min-instances 0 --concurrency 2 --cpu 2 --memory 2Gi --timeout 30 --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --set-secrets="LAB_SECRET=$SECRET:latest"
g run services describe "$SERVICE" --region="$REGION" --format=json | node scripts/lab/setup-helpers.mjs check-service
URL=$(g run services describe "$SERVICE" --region="$REGION" --format='value(status.url)')
[ -n "$URL" ] || die "the service has no URL"
STATUS=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/compile" || true)
[ "$STATUS" = 401 ] || die "a request without the secret got $STATUS, not 401"
echo "$URL answers 401 without the secret"

say "Budget"
if ! g pubsub topics describe "$TOPIC" >/dev/null 2>&1; then
  g pubsub topics create "$TOPIC"
fi
# Cloud Billing publishes budget messages as this account.
g pubsub topics add-iam-policy-binding "$TOPIC" \
  --member=serviceAccount:billing-budget-alert@system.gserviceaccount.com \
  --role=roles/pubsub.publisher >/dev/null \
  || echo "could not grant the budget publisher on $TOPIC; Cloud Billing may already have it" >&2
if [ -z "${BUDGET_AMOUNT:-}" ]; then
  CURRENCY=$(gcloud billing accounts describe "$BILLING_ACCOUNT" --format='value(currencyCode)' 2>/dev/null || true)
  case "${CURRENCY:-USD}" in
    USD) BUDGET_AMOUNT=1USD ;;
    *) die "the billing account bills in $CURRENCY; set BUDGET_AMOUNT to about 1 US dollar in it, e.g. BUDGET_AMOUNT=60$CURRENCY" ;;
  esac
fi
BUDGET=$(gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" \
  --filter="displayName=$BUDGET_NAME" --format='value(name)')
if [ -z "$BUDGET" ]; then
  gcloud billing budgets create --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" \
    --display-name="$BUDGET_NAME" --budget-amount="$BUDGET_AMOUNT" \
    --filter-projects="projects/$PROJECT" \
    --threshold-rule=percent=0.5 --threshold-rule=percent=0.9 --threshold-rule=percent=1.0 \
    --notifications-rule-pubsub-topic="projects/$PROJECT/topics/$TOPIC"
else
  echo "budget $BUDGET_NAME exists"
fi

say "Billing guard $GUARD"
node scripts/lab/setup-helpers.mjs guard "$(native "$WORK/guard")"
# --retry redelivers a message whose switch-off failed; a message the guard can't read is dropped.
g functions deploy "$GUARD" --gen2 --region="$REGION" --runtime=nodejs22 \
  --source="$(native "$WORK/guard")" --entry-point=onBudget --trigger-topic="$TOPIC" --retry \
  --service-account="$GUARD_SA" --trigger-service-account="$GUARD_SA" \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT" \
  --max-instances=1 --memory=256Mi --timeout=60s --no-allow-unauthenticated
retry g run services add-iam-policy-binding "$GUARD" --region="$REGION" \
  --member="serviceAccount:$GUARD_SA" --role=roles/run.invoker >/dev/null
echo "$GUARD_SA: roles/run.invoker on $GUARD"

say "Cloudflare Pages"
g secrets versions access latest --secret="$SECRET" \
  | npx wrangler pages secret put LAB_COMPILE_SECRET --project-name vams
node scripts/lab/setup-helpers.mjs compile-url "$URL"

say "Done. Record these in docs/lab-operations.md"
cat <<EOF
| Project | $PROJECT |
| Region | $REGION |
| Billing account | $BILLING_ACCOUNT |
| Service URL | $URL |
| Image | $IMAGE |
| Compile service account | $RUN_SA |
| Guard service account | $GUARD_SA |
| Budget | $BUDGET_NAME, $BUDGET_AMOUNT, alerts at 50%, 90% and 100% to $TOPIC |
EOF
if ! git diff --quiet -- wrangler.toml; then
  echo
  echo "wrangler.toml changed (LAB_COMPILE_URL). Commit it; the next Pages deploy uses it."
fi

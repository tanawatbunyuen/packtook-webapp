#!/usr/bin/env bash
# P231.102 — inherited public IAM at project, folder, org: READ ONLY.
# No cloud IAM writes or deploy; intentionally fail closed on unreadable ancestors.
set -u -o pipefail
set +x
PROJECT=packtook-staging
REGION=asia-southeast1
SERVICE=p231appcheckisolatedprobe
echo 'P231_CHECK=NEW_SERVICE_INHERITED_PUBLIC_IAM_READONLY'
for x in gcloud jq;do
 if ! command -v "$x" >/dev/null 2>&1;then echo 'P231_GATE=BLOCKED_REQUIRED_TOOL';exit 2;fi
done
if [ "$(gcloud config get-value project 2>/dev/null)" != "$PROJECT" ];then echo 'P231_GATE=BLOCKED_PROJECT';exit 2;fi
if ! gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT" --format=json >/dev/null 2>&1;then
 echo 'P231_GATE=BLOCKED_SERVICE_NOT_READABLE';exit 2
fi
echo 'P231_TARGET=STAGING_NEW_SERVICE_ONLY'
# Optional public IAM principals can carry inherited invoke permissions.
# Conservative check counts ANY roles on parent resources with public members.
# Does NOT prove absence of Google Cloud IAM Deny, org policy, conditional rules, or other access paths.
count_public(){
 local payload="$1"
 printf '%s' "$payload" | jq -r '
 [.bindings[]?| . as $b | .members[]? |
  select(.=="allUsers" or .=="allAuthenticatedUsers") |
  {role:$b.role,conditional:($b.condition!=null)}] |
 "P231_PARENT_PUBLIC_BINDINGS="+(length|tostring),
 (.[]| "P231_PARENT_PUBLIC_ROLE="+.role+" CONDITIONAL="+(.conditional|tostring))'
}
get_policy(){
 local label="$1"
 shift
 local policy
 policy="$("$@" 2>/dev/null)"
 if [ "$?" -ne 0 ] || ! printf '%s' "$policy" | jq -e '.bindings|type=="array" or .==null' >/dev/null 2>&1;then
  echo "P231_${label}_IAM=UNREADABLE"
  return 2
 fi
 echo "P231_${label}_IAM=READABLE"
 printf '%s' "$policy" | jq -r --arg label "$label" '
 [.bindings[]?| . as $b | .members[]? |
  select(.=="allUsers" or .=="allAuthenticatedUsers") |
  {role:$b.role,conditional:($b.condition!=null)}] as $x |
 "P231_"+$label+"_PUBLIC_BINDINGS="+($x|length|tostring),
 ($x[] | "P231_"+$label+"_PUBLIC_ROLE="+.role+" CONDITIONAL="+(.conditional|tostring))'
 local n
 n="$(printf '%s' "$policy" | jq '[.bindings[]?|.members[]?| select(.=="allUsers" or .=="allAuthenticatedUsers")]|length')"
 [ "$n" -eq 0 ]
}
FAILED=0
get_policy PROJECT gcloud projects get-iam-policy "$PROJECT" --format=json || FAILED=1

# Get project ancestry via Cloud Resource Manager. If not accessible, stop.
ANCESTORS="$(gcloud projects get-ancestors "$PROJECT" --format=json 2>/dev/null)"
if [ "$?" -ne 0 ];then
 echo 'P231_ANCESTRY=UNREADABLE'
 FAILED=1
else
 echo 'P231_ANCESTRY=READABLE'
 # Do not print ancestor names or identifiers.
 while IFS= read -r entry;do
   [ -z "$entry" ] && continue
   type="${entry%%:*}"; id="${entry#*:}"
   case "$type" in
    folder)
      get_policy FOLDER gcloud resource-manager folders get-iam-policy "$id" --format=json || FAILED=1 ;;
    organization)
      get_policy ORGANIZATION gcloud organizations get-iam-policy "$id" --format=json || FAILED=1 ;;
    project) ;;
    *) echo 'P231_ANCESTOR_TYPE=UNKNOWN'; FAILED=1 ;;
   esac
 done < <(printf '%s' "$ANCESTORS" | jq -r '.[] | "\(.type|ascii_downcase):\(.id)"')
fi
if [ "$FAILED" -ne 0 ];then
 echo 'P231_INHERITED_PUBLIC_IAM=FAIL_OR_INCOMPLETE'
else
 echo 'P231_INHERITED_PUBLIC_IAM=NO_EXPLICIT_PUBLIC_PRINCIPALS'
fi
echo 'P231_OPERATOR_SERVICE_INVOKER=NOT_GRANTED_BY_THIS_SCRIPT'
echo 'P231_IAM_WRITES=0'
echo 'P231_DEPLOY=NOT_PERFORMED'
echo 'P231_E2E=NOT_PERFORMED'
echo 'P231_RUNTIME_APPCHECK=NOT_VERIFIED'
echo 'P231_RELEASE=NO_GO'
exit "$([ "$FAILED" -eq 0 ] && echo 0 || echo 2)"

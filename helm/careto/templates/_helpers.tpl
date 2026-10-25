{{- define "careto.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "careto.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "careto.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "careto.labels" -}}
app.kubernetes.io/name: {{ include "careto.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "careto.imageRepository" -}}
{{- $root := .root -}}
{{- $image := .image -}}
{{- if $root.Values.devMode.enabled -}}
{{- printf "careto/%s" .component -}}
{{- else -}}
{{- $image.repository -}}
{{- end -}}
{{- end -}}

{{- define "careto.imageTag" -}}
{{- $root := .root -}}
{{- $image := .image -}}
{{- if $root.Values.devMode.enabled -}}
dev
{{- else -}}
{{- default $root.Chart.AppVersion $image.tag -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendEnvValue" -}}
{{- $root := .root -}}
{{- $key := .key -}}
{{- if $root.Values.devMode.enabled -}}
{{- if eq $key "NODE_ENV" -}}development
{{- else if eq $key "DB_SYNC" -}}true
{{- else if eq $key "SEED_ON_STARTUP" -}}true
{{- /* ADR-0005: registration is off by default, but dev and CI register
     throwaway users through the API (integration and e2e suites). */ -}}
{{- else if eq $key "AUTH_LOCAL_REGISTRATION_ENABLED" -}}true
{{- else if eq $key "JWT_SECRET" -}}change-me-dev-secret
{{- else if eq $key "FRONTEND_URL" -}}{{ printf "http://%s" $root.Values.ingress.host }}
{{- else if eq $key "RATE_LIMIT_LIMIT" -}}1000000
{{- /* ADR-0020: devMode never commits a real VAPID keypair — the backend
     mints its own ephemeral one at boot instead (config/env.ts). Real
     deployments keep VAPID_AUTO_GENERATE unset/"false" and provision a
     persisted keypair via backend.secrets.vapid. */ -}}
{{- else if eq $key "VAPID_AUTO_GENERATE" -}}true
{{- /* ADR-0018: the two TTLs get NO devMode override on purpose, so dev and
     CI exercise the real lifetimes. Only the reuse grace window is
     shortened, so the reuse-detection integration test needs a ~1.5s sleep
     instead of ~31s while still covering a genuine two-tab race (which
     resolves in ms). */ -}}
{{- else if eq $key "REFRESH_TOKEN_REUSE_GRACE_SECONDS" -}}1
{{- else -}}{{- index $root.Values.backend.env $key -}}
{{- end -}}
{{- else -}}
{{- index $root.Values.backend.env $key -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendJwtSecretName" -}}
{{- if .Values.devMode.enabled -}}
{{- printf "%s-backend" (include "careto.fullname" .) -}}
{{- else -}}
{{- .Values.backend.secrets.jwt.secretName -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendDatabaseSecretName" -}}
{{- if .Values.devMode.enabled -}}
{{- printf "%s-backend" (include "careto.fullname" .) -}}
{{- else -}}
{{- .Values.backend.secrets.database.secretName -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendOauthSecretName" -}}
{{- if .Values.devMode.enabled -}}
{{- printf "%s-backend" (include "careto.fullname" .) -}}
{{- else -}}
{{- .Values.backend.secrets.oauth.secretName -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendVapidSecretName" -}}
{{- if .Values.devMode.enabled -}}
{{- printf "%s-backend" (include "careto.fullname" .) -}}
{{- else -}}
{{- .Values.backend.secrets.vapid.secretName -}}
{{- end -}}
{{- end -}}

{{- define "careto.backendSecretKey" -}}
{{- $root := .root -}}
{{- $type := .type -}}
{{- if and $root.Values.devMode.enabled (eq $type "jwt") -}}JWT_SECRET
{{- else if and $root.Values.devMode.enabled (eq $type "hostname") -}}DB_HOSTNAME
{{- else if and $root.Values.devMode.enabled (eq $type "port") -}}DB_PORT
{{- else if and $root.Values.devMode.enabled (eq $type "username") -}}DB_USERNAME
{{- else if and $root.Values.devMode.enabled (eq $type "password") -}}DB_PASSWORD
{{- else if and $root.Values.devMode.enabled (eq $type "databaseName") -}}DB_DATABASE_NAME
{{- else if eq $type "jwt" -}}
{{- $root.Values.backend.secrets.jwt.key -}}
{{- else if eq $type "hostname" -}}
{{- $root.Values.backend.secrets.database.keys.hostname -}}
{{- else if eq $type "port" -}}
{{- $root.Values.backend.secrets.database.keys.port -}}
{{- else if eq $type "username" -}}
{{- $root.Values.backend.secrets.database.keys.username -}}
{{- else if eq $type "password" -}}
{{- $root.Values.backend.secrets.database.keys.password -}}
{{- else if and $root.Values.devMode.enabled (eq $type "oauthConfig") -}}OAUTH_CONFIG
{{- else if and $root.Values.devMode.enabled (eq $type "oauthStateSecret") -}}OAUTH_STATE_SECRET
{{- else if eq $type "oauthConfig" -}}
{{- $root.Values.backend.secrets.oauth.keys.config -}}
{{- else if eq $type "oauthStateSecret" -}}
{{- $root.Values.backend.secrets.oauth.keys.stateSecret -}}
{{- else if and $root.Values.devMode.enabled (eq $type "vapidPublicKey") -}}VAPID_PUBLIC_KEY
{{- else if and $root.Values.devMode.enabled (eq $type "vapidPrivateKey") -}}VAPID_PRIVATE_KEY
{{- else if eq $type "vapidPublicKey" -}}
{{- $root.Values.backend.secrets.vapid.keys.publicKey -}}
{{- else if eq $type "vapidPrivateKey" -}}
{{- $root.Values.backend.secrets.vapid.keys.privateKey -}}
{{- else -}}
{{- $root.Values.backend.secrets.database.keys.databaseName -}}
{{- end -}}
{{- end -}}

{{- define "careto.postgresSecretName" -}}
{{- if .Values.devMode.enabled -}}
{{- printf "%s-postgres" (include "careto.fullname" .) -}}
{{- else -}}
{{- .Values.postgres.auth.secretName -}}
{{- end -}}
{{- end -}}

{{- define "careto.postgresSecretKey" -}}
{{- $root := .root -}}
{{- $type := .type -}}
{{- if and $root.Values.devMode.enabled (eq $type "username") -}}POSTGRES_USER
{{- else if and $root.Values.devMode.enabled (eq $type "password") -}}POSTGRES_PASSWORD
{{- else if and $root.Values.devMode.enabled (eq $type "database") -}}POSTGRES_DB
{{- else if eq $type "username" -}}
{{- $root.Values.postgres.auth.keys.username -}}
{{- else if eq $type "password" -}}
{{- $root.Values.postgres.auth.keys.password -}}
{{- else -}}
{{- $root.Values.postgres.auth.keys.database -}}
{{- end -}}
{{- end -}}

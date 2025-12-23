{{/*
Expand the name of the chart.
*/}}
{{- define "delta-sharing-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "delta-sharing-ui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "delta-sharing-ui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "delta-sharing-ui.labels" -}}
helm.sh/chart: {{ include "delta-sharing-ui.chart" . }}
{{ include "delta-sharing-ui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "delta-sharing-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "delta-sharing-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "delta-sharing-ui.backendLabels" -}}
{{ include "delta-sharing-ui.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "delta-sharing-ui.backendSelectorLabels" -}}
{{ include "delta-sharing-ui.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "delta-sharing-ui.frontendLabels" -}}
{{ include "delta-sharing-ui.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "delta-sharing-ui.frontendSelectorLabels" -}}
{{ include "delta-sharing-ui.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Database URL
*/}}
{{- define "delta-sharing-ui.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "delta-sharing-ui.fullname" . }}-postgresql:5432/{{ .Values.postgresql.auth.database }}
{{- else }}
postgresql://{{ .Values.externalDatabase.username }}:{{ .Values.externalDatabase.password }}@{{ .Values.externalDatabase.host }}:{{ .Values.externalDatabase.port }}/{{ .Values.externalDatabase.database }}
{{- end }}
{{- end }}

{{/*
Generate JWT secret
*/}}
{{- define "delta-sharing-ui.jwtSecret" -}}
{{- if .Values.auth.jwtSecret }}
{{- .Values.auth.jwtSecret }}
{{- else }}
{{- randAlphaNum 64 }}
{{- end }}
{{- end }}

{{/*
Generate encryption key
*/}}
{{- define "delta-sharing-ui.encryptionKey" -}}
{{- if .Values.auth.encryptionKey }}
{{- .Values.auth.encryptionKey }}
{{- else }}
{{- randAlphaNum 64 | lower }}
{{- end }}
{{- end }}

{{/*
Validate required secrets
This helper should be called in deployment templates to fail early if required values are missing.
*/}}
{{- define "delta-sharing-ui.validateSecrets" -}}
{{- if not .Values.auth.jwtSecret }}
{{- fail "auth.jwtSecret is required. Generate with: openssl rand -base64 32" }}
{{- end }}
{{- if not .Values.auth.encryptionKey }}
{{- fail "auth.encryptionKey is required. Generate with: openssl rand -hex 32" }}
{{- end }}
{{- if not .Values.auth.admin.email }}
{{- fail "auth.admin.email is required" }}
{{- end }}
{{- if not .Values.auth.admin.password }}
{{- fail "auth.admin.password is required" }}
{{- end }}
{{- end }}









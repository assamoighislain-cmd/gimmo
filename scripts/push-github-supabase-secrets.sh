#!/usr/bin/env bash
set -euo pipefail

# Envoie automatiquement les 4 variables Supabase du fichier .env local
# vers les Secrets GitHub Actions du dépôt, sans jamais les commiter dans Git.
#
# Usage :
#   bash scripts/push-github-supabase-secrets.sh [proprietaire/depot]

REPO="${1:-}"
ENV_FILE=".env"

if ! command -v gh >/dev/null 2>&1; then
  echo "Erreur : GitHub CLI (gh) n'est pas installé. Installez-le depuis https://cli.github.com/"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Erreur : fichier $ENV_FILE introuvable à la racine du projet."
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Connexion à GitHub requise..."
  gh auth login
fi

VARS=(
  "SUPABASE_URL"
  "SUPABASE_PUBLISHABLE_KEY"
  "SUPABASE_SECRET_KEY"
  "SUPABASE_JWKS_URL"
)

for VAR_NAME in "${VARS[@]}"; do
  VALUE="$(grep -E "^${VAR_NAME}=" "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
  if [ -z "$VALUE" ]; then
    echo "Ignoré (vide dans $ENV_FILE) : $VAR_NAME"
    continue
  fi

  if [ -n "$REPO" ]; then
    printf "%s" "$VALUE" | gh secret set "$VAR_NAME" --repo "$REPO"
  else
    printf "%s" "$VALUE" | gh secret set "$VAR_NAME"
  fi
  echo "Secret GitHub configuré : $VAR_NAME"
done

echo "Terminé : les variables Supabase ont été ajoutées dans GitHub Secrets."

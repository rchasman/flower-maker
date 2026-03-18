#!/usr/bin/env bash
set -euo pipefail

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }
bold()  { printf '\033[1m%s\033[0m\n' "$*"; }

fail() { red "✗ $1"; exit 1; }
ok()   { green "✓ $1"; }

cd "$(dirname "$0")/.."

# ── 1. Preflight: required CLIs ──────────────────────────────────────────────

bold "Checking prerequisites…"

command -v bun       >/dev/null || fail "bun not found — install from https://bun.sh"
command -v spacetime >/dev/null || fail "spacetime CLI not found — install from https://spacetimedb.com/install"
command -v cargo     >/dev/null || fail "cargo not found — install from https://rustup.rs"
command -v portless  >/dev/null || fail "portless not found — install with: bun add -g portless"

ok "All CLIs present"

# ── 2. Install dependencies ──────────────────────────────────────────────────

bold "Installing dependencies…"
bun install
ok "Dependencies installed"

# ── 3. Environment ──────────────────────────────────────────────────────────

if [ ! -f .env ]; then
  cp .env.example .env
  ok "Created .env from .env.example — fill in ANTHROPIC_API_KEY for AI features"
else
  dim ".env already exists, skipping"
fi

# ── 4. Deploy SpacetimeDB module to maincloud + generate bindings ─────────────

bold "Publishing SpacetimeDB module to maincloud and generating client bindings…"
bun run db:deploy
ok "Module published to maincloud and bindings generated"
dim "Local publish happens automatically when you run: bun run dev"

# ── 5. Done ──────────────────────────────────────────────────────────────────

echo ""
green "Setup complete!"
echo ""
dim "Start developing:"
dim "  bun run dev          — client + API + local SpacetimeDB"
dim "  bun run dev:agent    — AI flower agent"
dim "  bun run db:logs      — tail maincloud logs"

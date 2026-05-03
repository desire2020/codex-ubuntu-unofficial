#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
resources_dir="${repo_root}/dist/nocleanroom-official/resources"
electron_bin="${repo_root}/official-linux/node_modules/electron/dist/electron"

if [[ ! -f "${resources_dir}/app.asar" ]]; then
  echo "Official Codex resources are not staged. Run: npm --prefix official-linux run stage" >&2
  exit 1
fi

if [[ ! -x "${electron_bin}" ]]; then
  echo "Linux Electron is not installed. Run: npm --prefix official-linux install" >&2
  exit 1
fi

export CODEX_ELECTRON_RESOURCES_PATH="${resources_dir}"
export CODEX_CLI_PATH="${resources_dir}/codex"
export CODEX_BROWSER_USE_NODE_PATH="${resources_dir}/node"
export CODEX_NODE_REPL_PATH="${resources_dir}/node_repl"
export BUILD_FLAVOR="${BUILD_FLAVOR:-prod}"
export NODE_ENV="${NODE_ENV:-production}"
export ELECTRON_NO_ATTACH_CONSOLE="${ELECTRON_NO_ATTACH_CONSOLE:-1}"
export CODEX_ELECTRON_FORCE_BUNDLED_WEBVIEW="${CODEX_ELECTRON_FORCE_BUNDLED_WEBVIEW:-1}"
unset ELECTRON_RUN_AS_NODE

electron_args=(--no-sandbox)
if [[ -n "${CODEX_ELECTRON_OZONE_PLATFORM:-x11}" ]]; then
  electron_args+=("--ozone-platform=${CODEX_ELECTRON_OZONE_PLATFORM:-x11}")
fi
if [[ -n "${CODEX_ELECTRON_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  extra_args=(${CODEX_ELECTRON_EXTRA_ARGS})
  electron_args+=("${extra_args[@]}")
fi

exec "${electron_bin}" "${electron_args[@]}" "${resources_dir}/app.asar" "$@"

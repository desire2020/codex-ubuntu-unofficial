#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
package_name="codex-desktop-ubuntu"
package_version="26.513.31313+ubuntu.1"
arch="amd64"
build_root="${repo_root}/dist/deb/${package_name}_${package_version}_${arch}"
install_root="${build_root}/opt/${package_name}"
resources_dir="${repo_root}/dist/nocleanroom-official/resources"
electron_dist="${repo_root}/official-linux/node_modules/electron/dist"
deb_out="${repo_root}/dist/${package_name}_${package_version}_${arch}.deb"
latest_out="${repo_root}/dist/codex-desktop-ubuntu-latest_${arch}.deb"
nocleanroom_latest_out="${repo_root}/dist/codex-desktop-ubuntu-nocleanroom-latest_${arch}.deb"

if [[ ! -f "${resources_dir}/app.asar" ]]; then
  echo "Official Codex resources are not staged. Run: npm --prefix official-linux run stage" >&2
  exit 1
fi

if [[ ! -x "${electron_dist}/electron" ]]; then
  echo "Linux Electron is not installed. Run: npm --prefix official-linux install" >&2
  exit 1
fi

rm -rf "${build_root}"
mkdir -p \
  "${install_root}/electron" \
  "${install_root}/resources" \
  "${build_root}/DEBIAN" \
  "${build_root}/usr/bin" \
  "${build_root}/usr/share/applications" \
  "${build_root}/usr/share/pixmaps"

cp -a "${electron_dist}/." "${install_root}/electron/"
cp -a "${resources_dir}/." "${install_root}/resources/"

if command -v ldd >/dev/null 2>&1; then
  conda_lib_dir="${install_root}/conda-lib"
  conda_prefix="${CONDA_PREFIX:-}"
  mkdir -p "${conda_lib_dir}"
  if [[ -n "${conda_prefix}" ]]; then
    linked_files=(
      "${resources_dir}/codex"
      "${conda_prefix}/bin/node"
      "${resources_dir}/node"
      "${resources_dir}/rg"
      "${resources_dir}/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node"
      "${resources_dir}/app.asar.unpacked/node_modules/node-pty/build/Release/pty.node"
      "${resources_dir}/app.asar.unpacked/node_modules/node-pty/build/Release/spawn-helper"
    )
    for linked_file in "${linked_files[@]}"; do
      [[ -e "${linked_file}" ]] || continue
      while IFS= read -r lib; do
        real_lib="$(readlink -f "${lib}" 2>/dev/null || true)"
        [[ "${real_lib}" == "${conda_prefix}/lib/"* ]] || continue
        cp -a --update=none "${lib}" "${conda_lib_dir}/" || true
        cp -a --update=none "${real_lib}" "${conda_lib_dir}/" || true
      done < <(ldd "${linked_file}" 2>/dev/null | awk '{ print $3 }')
    done
  fi
  if ! find "${conda_lib_dir}" -type f -print -quit | grep -q .; then
    rmdir "${conda_lib_dir}"
  fi
fi

cat > "${build_root}/DEBIAN/control" <<CONTROL
Package: ${package_name}
Version: ${package_version}
Section: devel
Priority: optional
Architecture: ${arch}
Depends: libgtk-3-0, libnss3, libxss1, libasound2t64 | libasound2, libx11-xcb1, libxcb-dri3-0, libdrm2, libgbm1
Conflicts: codex-desktop-ubuntu-nocleanroom
Replaces: codex-desktop-ubuntu-nocleanroom
Maintainer: sidilu
Description: Unofficial Linux package for the official OpenAI Codex desktop app bundle
 This package stages the official Codex Electron bundle from macOS resources and runs it
 with Linux Electron plus rebuilt native modules.
CONTROL

cat > "${build_root}/usr/bin/codex-desktop-nocleanroom" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

app_root="/opt/codex-desktop-ubuntu"
resources_dir="${app_root}/resources"
electron_bin="${app_root}/electron/electron"

if [[ -d "${app_root}/conda-lib" ]]; then
  export LD_LIBRARY_PATH="${app_root}/conda-lib:${LD_LIBRARY_PATH:-}"
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

foreground="${CODEX_DESKTOP_FOREGROUND:-0}"
debug="${CODEX_DESKTOP_DEBUG:-0}"
remaining_args=()
for arg in "$@"; do
  case "${arg}" in
    --foreground)
      foreground=1
      ;;
    --debug)
      debug=1
      foreground=1
      ;;
    *)
      remaining_args+=("${arg}")
      ;;
  esac
done

if [[ "${debug}" == "1" ]]; then
  export ELECTRON_ENABLE_LOGGING="${ELECTRON_ENABLE_LOGGING:-1}"
fi

if [[ "${foreground}" == "1" || "${debug}" == "1" ]]; then
  exec "${electron_bin}" "${electron_args[@]}" "${resources_dir}/app.asar" "${remaining_args[@]}"
fi

home_dir="${HOME:-/tmp}"
log_dir="${XDG_CACHE_HOME:-${home_dir}/.cache}/codex-desktop-ubuntu"
mkdir -p "${log_dir}"
log_file="${log_dir}/codex-desktop.log"
nohup "${electron_bin}" "${electron_args[@]}" "${resources_dir}/app.asar" "${remaining_args[@]}" >>"${log_file}" 2>&1 </dev/null &
disown >/dev/null 2>&1 || true
exit 0
WRAPPER
chmod 0755 "${build_root}/usr/bin/codex-desktop-nocleanroom"

cat > "${build_root}/usr/bin/codex-desktop" <<'DESKTOP_WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

exec /usr/bin/codex-desktop-nocleanroom "$@"
DESKTOP_WRAPPER
chmod 0755 "${build_root}/usr/bin/codex-desktop"

cat > "${build_root}/usr/bin/codex" <<'CODEX_WRAPPER'
#!/usr/bin/env bash
set -euo pipefail

app_root="/opt/codex-desktop-ubuntu"

if [[ "${1:-}" == "app" ]]; then
  shift
  exec /usr/bin/codex-desktop-nocleanroom "$@"
fi

if [[ -d "${app_root}/conda-lib" ]]; then
  export LD_LIBRARY_PATH="${app_root}/conda-lib:${LD_LIBRARY_PATH:-}"
fi

exec "${app_root}/resources/codex" "$@"
CODEX_WRAPPER
chmod 0755 "${build_root}/usr/bin/codex"

cat > "${build_root}/usr/share/applications/codex.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Codex Desktop
Comment=OpenAI Codex desktop app
Exec=codex app %F
Icon=codex-desktop-nocleanroom
Terminal=false
Categories=Development;IDE;
StartupWMClass=Codex
DESKTOP

cp "${resources_dir}/codexTemplate@2x.png" "${build_root}/usr/share/pixmaps/codex-desktop-nocleanroom.png"

find "${build_root}" -type d -exec chmod 0755 {} +
dpkg-deb --build --root-owner-group "${build_root}" "${deb_out}"
cp "${deb_out}" "${latest_out}"
cp "${deb_out}" "${nocleanroom_latest_out}"

echo "Built ${deb_out}"
echo "Updated ${latest_out}"
echo "Updated ${nocleanroom_latest_out}"

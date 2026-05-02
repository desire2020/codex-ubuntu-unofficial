#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pkg="codex-desktop-ubuntu"
version="0.1.22+ubuntu.1"
arch="$(dpkg --print-architecture)"
root="$repo_root/dist/deb-root"
out="$repo_root/dist/${pkg}_${version}_${arch}.deb"
latest="$repo_root/dist/${pkg}-latest_${arch}.deb"
electron_dist="$repo_root/ubuntu-app/node_modules/electron/dist"
codex_bin="$repo_root/codex-rs/target/release/codex"

if [[ ! -x "$codex_bin" ]]; then
  echo "missing release Codex binary at $codex_bin" >&2
  echo "run: source ~/anaconda3/bin/activate base && (cd codex-rs && cargo build -p codex-cli --release)" >&2
  exit 1
fi

if [[ ! -x "$electron_dist/electron" ]]; then
  echo "missing Electron runtime at $electron_dist" >&2
  echo "run: source ~/anaconda3/bin/activate base && npm --prefix ubuntu-app install" >&2
  exit 1
fi

rm -rf "$root" "$out"
install -d \
  "$root/DEBIAN" \
  "$root/opt/codex-desktop-ubuntu/app" \
  "$root/opt/codex-desktop-ubuntu/bin" \
  "$root/opt/codex-desktop-ubuntu/electron" \
  "$root/opt/codex-desktop-ubuntu/lib" \
  "$root/usr/bin" \
  "$root/usr/share/applications" \
  "$root/usr/share/doc/$pkg"

cp -a "$electron_dist/." "$root/opt/codex-desktop-ubuntu/electron/"
install -m 0755 "$codex_bin" "$root/opt/codex-desktop-ubuntu/bin/codex"
install -m 0644 "$repo_root/ubuntu-app/package.json" "$root/opt/codex-desktop-ubuntu/app/package.json"
install -m 0644 "$repo_root/ubuntu-app/index.html" "$root/opt/codex-desktop-ubuntu/app/index.html"
install -m 0644 "$repo_root/ubuntu-app/styles.css" "$root/opt/codex-desktop-ubuntu/app/styles.css"
install -m 0644 "$repo_root/ubuntu-app/main.js" "$root/opt/codex-desktop-ubuntu/app/main.js"
install -m 0644 "$repo_root/ubuntu-app/preload.js" "$root/opt/codex-desktop-ubuntu/app/preload.js"
install -m 0644 "$repo_root/ubuntu-app/renderer.js" "$root/opt/codex-desktop-ubuntu/app/renderer.js"
install -d "$root/opt/codex-desktop-ubuntu/app/vendor"
install -m 0644 "$repo_root/ubuntu-app/vendor/markdown-it.min.js" "$root/opt/codex-desktop-ubuntu/app/vendor/markdown-it.min.js"

while IFS= read -r lib; do
  [[ -n "$lib" ]] || continue
  real="$(readlink -f "$lib")"
  install -m 0644 "$real" "$root/opt/codex-desktop-ubuntu/lib/$(basename "$real")"
  soname="$(basename "$lib")"
  target="$(basename "$real")"
  if [[ "$soname" != "$target" && ! -e "$root/opt/codex-desktop-ubuntu/lib/$soname" ]]; then
    ln -s "$target" "$root/opt/codex-desktop-ubuntu/lib/$soname"
  fi
done < <(ldd "$codex_bin" | awk '$3 ~ /^\/home\/sidilu\/anaconda3\/lib\// { print $3 }')

cat > "$root/usr/bin/codex" <<'WRAPPER'
#!/bin/sh
set -eu
export LD_LIBRARY_PATH="/opt/codex-desktop-ubuntu/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec /opt/codex-desktop-ubuntu/bin/codex "$@"
WRAPPER
chmod 0755 "$root/usr/bin/codex"

cat > "$root/usr/bin/codex-desktop" <<'WRAPPER'
#!/bin/sh
set -eu
export LD_LIBRARY_PATH="/opt/codex-desktop-ubuntu/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
log_dir="${XDG_STATE_HOME:-${HOME:-/tmp}/.local/state}/codex-desktop"
mkdir -p "$log_dir" 2>/dev/null || log_dir="/tmp"
nohup /opt/codex-desktop-ubuntu/electron/electron \
  /opt/codex-desktop-ubuntu/app "$@" >>"$log_dir/codex-desktop.log" 2>&1 &
exit 0
WRAPPER
chmod 0755 "$root/usr/bin/codex-desktop"

cat > "$root/usr/share/applications/codex.desktop" <<'DESKTOP'
[Desktop Entry]
Type=Application
Name=Codex
GenericName=Codex Desktop
Comment=Open the Codex desktop app
Exec=/usr/bin/codex-desktop %f
Terminal=false
Icon=utilities-terminal
Categories=Development;IDE;
MimeType=inode/directory;
StartupNotify=true
DESKTOP
chmod 0644 "$root/usr/share/applications/codex.desktop"

cat > "$root/usr/share/doc/$pkg/README.Debian" <<'README'
Codex Desktop Ubuntu unofficial package

This package installs an Electron-based Ubuntu desktop app for Codex. The app
uses the local Codex app-server protocol and includes the Codex release binary,
Electron runtime, and non-system shared libraries produced by the local conda
build.
README
gzip -9n "$root/usr/share/doc/$pkg/README.Debian"

cat > "$root/usr/share/doc/$pkg/copyright" <<'COPYRIGHT'
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: Codex
Source: local build from this repository

Files: *
Copyright: OpenAI and contributors
License: Apache-2.0
 This package is an unofficial Ubuntu build artifact generated from the local
 repository checkout.
COPYRIGHT
chmod 0644 "$root/usr/share/doc/$pkg/copyright"

cat > "$root/DEBIAN/postinst" <<'POSTINST'
#!/bin/sh
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
exit 0
POSTINST
chmod 0755 "$root/DEBIAN/postinst"

cat > "$root/DEBIAN/postrm" <<'POSTRM'
#!/bin/sh
set -e
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications || true
fi
exit 0
POSTRM
chmod 0755 "$root/DEBIAN/postrm"

installed_size="$(du -sk "$root" | awk '{print $1}')"
cat > "$root/DEBIAN/control" <<CONTROL
Package: $pkg
Version: $version
Section: devel
Priority: optional
Architecture: $arch
Maintainer: OpenAI Codex Ubuntu Unofficial <noreply@example.invalid>
Depends: libc6 (>= 2.39), libgtk-3-0, libnss3, libnspr4, libxss1, libatk1.0-0, libatk-bridge2.0-0, libdrm2, libgbm1, libasound2t64 | libasound2, libx11-6, libxcb1, libxcomposite1, libxdamage1, libxext6, libxfixes3, libxrandr2, libxkbcommon0, libpango-1.0-0, libcairo2, libglib2.0-0, libatspi2.0-0, libcups2, libdbus-1-3, libudev1, libfontconfig1, libfreetype6, libxi6, libxcursor1, libxinerama1, libxrender1, libwayland-client0, libwayland-cursor0, libwayland-egl1
Installed-Size: $installed_size
Homepage: https://github.com/openai/codex
Description: Unofficial Ubuntu desktop app for Codex
 Installs an Electron-based Codex desktop app with a sidebar, chat surface, and
 review/diff pane backed by the local Codex app-server protocol.
CONTROL
chmod 0644 "$root/DEBIAN/control"

(cd "$root" && find . -type f ! -path './DEBIAN/*' -print0 | sort -z | xargs -0 md5sum > DEBIAN/md5sums)
find "$root" -type d -exec chmod 0755 {} +
find "$root" -type f -exec chmod go-w {} +
chmod 0755 "$root/usr/bin/codex" "$root/usr/bin/codex-desktop" "$root/DEBIAN/postinst" "$root/DEBIAN/postrm" "$root/opt/codex-desktop-ubuntu/bin/codex" "$root/opt/codex-desktop-ubuntu/electron/electron"
chmod 4755 "$root/opt/codex-desktop-ubuntu/electron/chrome-sandbox"

dpkg-deb --root-owner-group --build "$root" "$out"
cp -f "$out" "$latest"
echo "$out"
echo "$latest"

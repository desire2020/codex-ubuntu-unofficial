# Codex Desktop for Ubuntu from the Official App Bundle

This directory is the `nocleanroom` Linux packaging harness. It does not reimplement the desktop UI.
Instead, it stages the official Electron app bundle from `~/Codex.app`, replaces macOS binaries with
Linux equivalents, rebuilds native modules for Linux/Electron, and runs or packages the result.

## Build

```bash
source ~/anaconda3/bin/activate base
npm --prefix official-linux install --ignore-scripts
npm --prefix official-linux run install-electron
npm --prefix official-linux run rebuild-native
cargo build --release -p codex-cli --manifest-path codex-rs/Cargo.toml
npm --prefix official-linux run stage
```

## Run

```bash
source ~/anaconda3/bin/activate base
npm --prefix official-linux start
```

The runner sets the resource path and CLI overrides expected by the official app and launches Linux
Electron with `--no-sandbox`. On Linux it defaults to `--ozone-platform=x11` because the official
bundle crashes on this NVIDIA/Wayland EGL path; set `CODEX_ELECTRON_OZONE_PLATFORM=wayland` to test
native Wayland again.

## Package

```bash
source ~/anaconda3/bin/activate base
scripts/build-nocleanroom-official-deb.sh
```

The packaged app uses `/opt/codex-desktop-ubuntu` and upgrades the existing
`codex-desktop-ubuntu` Debian package, so `codex app` launches this nocleanroom
desktop build. Terminal launches are quiet by default; Electron/app logs are
written to `${XDG_CACHE_HOME:-~/.cache}/codex-desktop-ubuntu/codex-desktop.log`.
Use `codex app --foreground` or `codex app --debug` when live terminal logs are
needed.

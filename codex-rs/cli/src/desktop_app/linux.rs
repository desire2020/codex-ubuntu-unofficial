use anyhow::Context as _;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::Path;
use std::path::PathBuf;
use tokio::process::Command;

pub async fn run_linux_app_open_or_install(
    workspace: PathBuf,
    download_url_override: Option<String>,
) -> anyhow::Result<()> {
    if let Some(app_path) = find_existing_codex_app_path()? {
        eprintln!(
            "Opening Codex Desktop at {app_path}...",
            app_path = app_path.display()
        );
        open_codex_desktop(&app_path, &workspace).await?;
        return Ok(());
    }

    if let Some(download_url) = download_url_override {
        eprintln!("Codex Desktop not found; opening Linux installer override...");
        open_url(&download_url).await?;
        eprintln!(
            "After installing Codex Desktop, open workspace {workspace}.",
            workspace = workspace.display()
        );
        return Ok(());
    }

    eprintln!("Codex Desktop not found; installing Ubuntu desktop launcher...");
    let codex_bin = std::env::current_exe().context("failed to resolve current Codex binary")?;
    let app_path = install_user_codex_desktop_launcher(&codex_bin)?;
    eprintln!(
        "Launching Codex Desktop from {app_path}...",
        app_path = app_path.display()
    );
    open_codex_desktop(&app_path, &workspace).await
}

fn find_existing_codex_app_path() -> anyhow::Result<Option<PathBuf>> {
    if let Some(app_path) = std::env::var_os("CODEX_DESKTOP_APP") {
        let app_path = PathBuf::from(app_path);
        if is_executable_file(&app_path) {
            return Ok(Some(app_path));
        }
    }

    for candidate in [
        PathBuf::from("/usr/local/bin/codex-desktop"),
        PathBuf::from("/usr/bin/codex-desktop"),
    ] {
        if is_executable_file(&candidate) {
            return Ok(Some(candidate));
        }
    }

    Ok(None)
}

fn is_executable_file(path: &Path) -> bool {
    fs::metadata(path)
        .is_ok_and(|metadata| metadata.is_file() && metadata.permissions().mode() & 0o111 != 0)
}

async fn open_codex_desktop(app_path: &Path, workspace: &Path) -> anyhow::Result<()> {
    eprintln!(
        "Opening workspace {workspace}...",
        workspace = workspace.display()
    );
    let status = Command::new(app_path)
        .arg(workspace)
        .status()
        .await
        .with_context(|| format!("failed to invoke `{}`", app_path.display()))?;

    if status.success() {
        return Ok(());
    }

    anyhow::bail!(
        "`{app_path} {workspace}` exited with {status}",
        app_path = app_path.display(),
        workspace = workspace.display()
    );
}

async fn open_url(url: &str) -> anyhow::Result<()> {
    match Command::new("xdg-open").arg(url).status().await {
        Ok(status) if status.success() => return Ok(()),
        Ok(_) | Err(_) => {}
    }

    let status = Command::new("gio")
        .arg("open")
        .arg(url)
        .status()
        .await
        .with_context(|| format!("failed to open {url} with xdg-open or gio"))?;

    if status.success() {
        return Ok(());
    }

    anyhow::bail!("failed to open {url} with {status}");
}

fn install_user_codex_desktop_launcher(codex_bin: &Path) -> anyhow::Result<PathBuf> {
    let launcher_path = user_launcher_path()?;
    let desktop_entry_path = home_dir()?
        .join(".local")
        .join("share")
        .join("applications")
        .join("codex.desktop");

    write_file_with_mode(
        &launcher_path,
        &render_launcher_script(&codex_bin.to_string_lossy()),
        /*mode*/ 0o755,
    )?;
    write_file_with_mode(
        &desktop_entry_path,
        &render_desktop_entry(&launcher_path.to_string_lossy()),
        /*mode*/ 0o644,
    )?;

    Ok(launcher_path)
}

fn write_file_with_mode(path: &Path, contents: &str, mode: u32) -> anyhow::Result<()> {
    write_file_if_changed(path, contents)?;
    let mut permissions = fs::metadata(path)
        .with_context(|| format!("failed to stat {}", path.display()))?
        .permissions();
    permissions.set_mode(mode);
    fs::set_permissions(path, permissions)
        .with_context(|| format!("failed to set permissions on {}", path.display()))?;
    Ok(())
}

fn write_file_if_changed(path: &Path, contents: &str) -> anyhow::Result<()> {
    if fs::read_to_string(path).is_ok_and(|existing| existing == contents) {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create {}", parent.display()))?;
    }
    fs::write(path, contents).with_context(|| format!("failed to write {}", path.display()))?;
    Ok(())
}

fn user_launcher_path() -> anyhow::Result<PathBuf> {
    Ok(home_dir()?
        .join(".local")
        .join("share")
        .join("codex-desktop")
        .join("codex-desktop"))
}

fn home_dir() -> anyhow::Result<PathBuf> {
    let home = std::env::var_os("HOME").context("HOME is not set")?;
    Ok(PathBuf::from(home))
}

fn render_launcher_script(codex_bin: &str) -> String {
    let codex_bin = shell_single_quote(codex_bin);
    format!(
        r#"#!/usr/bin/env sh
set -eu

CODEX_BIN={codex_bin}
WORKSPACE="${{1:-${{PWD:-${{HOME}}}}}}"

if [ ! -d "$WORKSPACE" ]; then
    printf '%s\n' "Workspace is not a directory: $WORKSPACE" >&2
    exit 2
fi

if [ -n "${{WAYLAND_DISPLAY:-}}${{DISPLAY:-}}" ]; then
    if command -v x-terminal-emulator >/dev/null 2>&1; then
        exec x-terminal-emulator -e "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v gnome-terminal >/dev/null 2>&1; then
        exec gnome-terminal --working-directory="$WORKSPACE" -- "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v kgx >/dev/null 2>&1; then
        exec kgx --working-directory="$WORKSPACE" -- "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v konsole >/dev/null 2>&1; then
        exec konsole --workdir "$WORKSPACE" -e "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v alacritty >/dev/null 2>&1; then
        exec alacritty --working-directory "$WORKSPACE" -e "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v kitty >/dev/null 2>&1; then
        exec kitty --directory "$WORKSPACE" "$CODEX_BIN" --cd "$WORKSPACE"
    fi
    if command -v xterm >/dev/null 2>&1; then
        exec xterm -e "$CODEX_BIN" --cd "$WORKSPACE"
    fi
fi

exec "$CODEX_BIN" --cd "$WORKSPACE"
"#
    )
}

fn render_desktop_entry(launcher_path: &str) -> String {
    let launcher_path = desktop_exec_quote(launcher_path);
    format!(
        r#"[Desktop Entry]
Type=Application
Name=Codex
GenericName=Codex Desktop
Comment=Open Codex in a workspace
Exec={launcher_path} %f
Terminal=false
Icon=utilities-terminal
Categories=Development;IDE;
MimeType=inode/directory;
StartupNotify=true
"#
    )
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn desktop_exec_quote(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

#[cfg(test)]
mod tests {
    use super::desktop_exec_quote;
    use super::render_desktop_entry;
    use super::render_launcher_script;
    use super::shell_single_quote;
    use pretty_assertions::assert_eq;

    #[test]
    fn shell_quote_handles_apostrophes() {
        assert_eq!(
            shell_single_quote("/tmp/Codex's bin/codex"),
            "'/tmp/Codex'\"'\"'s bin/codex'"
        );
    }

    #[test]
    fn desktop_quote_handles_backslashes_and_quotes() {
        assert_eq!(
            desktop_exec_quote(r#"/tmp/codex "desktop"\launcher"#),
            r#""/tmp/codex \"desktop\"\\launcher""#
        );
    }

    #[test]
    fn launcher_script_opens_codex_with_workspace_cwd() {
        let script = render_launcher_script("/opt/codex/bin/codex");

        assert!(script.contains("CODEX_BIN='/opt/codex/bin/codex'"));
        assert!(script.contains("exec gnome-terminal --working-directory=\"$WORKSPACE\""));
        assert!(script.contains("exec \"$CODEX_BIN\" --cd \"$WORKSPACE\""));
    }

    #[test]
    fn desktop_entry_registers_directory_launcher() {
        assert_eq!(
            render_desktop_entry("/home/me/.local/share/codex-desktop/codex-desktop"),
            r#"[Desktop Entry]
Type=Application
Name=Codex
GenericName=Codex Desktop
Comment=Open Codex in a workspace
Exec="/home/me/.local/share/codex-desktop/codex-desktop" %f
Terminal=false
Icon=utilities-terminal
Categories=Development;IDE;
MimeType=inode/directory;
StartupNotify=true
"#
        );
    }
}

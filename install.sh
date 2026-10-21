#!/bin/sh
# Installs the SYSTM BUILDS skills for agents that read skills folders, and a `systm` launcher.
# Symlinks by default, so `git pull` updates them. Use --copy for plain copies.
# Never overwrites a folder it did not create.
set -eu

here=$(cd "$(dirname "$0")" && pwd -P)
plugin="$here/plugins/systm-builds"
mode=link
targets=""
bindir="${SYSTM_BIN_DIR:-$HOME/.local/bin}"
action=install

usage() {
  cat <<USAGE
usage: ./install.sh [--claude] [--codex] [--openclaw] [--all] [--dest DIR] [--copy] [--no-bin] [--uninstall]

  --claude    ~/.claude/skills
  --codex     ~/.codex/skills
  --openclaw  ~/.openclaw/skills
  --all       all three
  --dest DIR  any other skills folder
  --copy      copy instead of symlink
  --no-bin    do not install the systm launcher in $bindir
  --uninstall remove only what this script installed
Default with no target flag: every one of the three whose parent folder (~/.claude, ~/.codex, ~/.openclaw) exists.
USAGE
}

nobin=0
while [ $# -gt 0 ]; do
  case "$1" in
    --claude) targets="$targets $HOME/.claude/skills" ;;
    --codex) targets="$targets $HOME/.codex/skills" ;;
    --openclaw) targets="$targets $HOME/.openclaw/skills" ;;
    --all) targets="$targets $HOME/.claude/skills $HOME/.codex/skills $HOME/.openclaw/skills" ;;
    --dest) shift; targets="$targets $1" ;;
    --copy) mode=copy ;;
    --no-bin) nobin=1 ;;
    --uninstall) action=uninstall ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if [ -z "$targets" ]; then
  for a in claude codex openclaw; do
    [ -d "$HOME/.$a" ] && targets="$targets $HOME/.$a/skills"
  done
fi
if [ -z "$targets" ]; then echo "no agent folder found; pass --claude, --codex, --openclaw or --dest DIR" >&2; exit 1; fi

marker=".systm-builds-installed"

for dest in $targets; do
  if [ "$action" = uninstall ]; then
    for s in "$plugin"/skills/*/; do
      name=$(basename "$s"); t="$dest/$name"
      if [ -L "$t" ] && [ "$(readlink "$t")" = "${s%/}" ]; then rm "$t"; echo "removed $t"
      elif [ -d "$t" ] && [ -f "$t/$marker" ]; then rm -rf "$t"; echo "removed $t"; fi
    done
    continue
  fi
  mkdir -p "$dest"
  for s in "$plugin"/skills/*/; do
    name=$(basename "$s"); t="$dest/$name"
    if [ -e "$t" ] || [ -L "$t" ]; then
      if [ -L "$t" ] && [ "$(readlink "$t")" = "${s%/}" ]; then continue; fi
      if [ -d "$t" ] && [ -f "$t/$marker" ] && [ "$mode" = copy ]; then rm -rf "$t"; else echo "skip $t (exists, not created by this script)"; continue; fi
    fi
    if [ "$mode" = copy ]; then cp -R "${s%/}" "$t"; : > "$t/$marker"; else ln -s "${s%/}" "$t"; fi
  done
  echo "skills -> $dest ($mode)"
done

if [ "$nobin" = 0 ]; then
  if [ "$action" = uninstall ]; then
    if [ -L "$bindir/systm" ] && [ "$(readlink "$bindir/systm")" = "$plugin/bin/systm" ]; then rm "$bindir/systm"; echo "removed $bindir/systm"; fi
  else
    mkdir -p "$bindir"
    if [ -e "$bindir/systm" ] && [ ! -L "$bindir/systm" ]; then echo "skip $bindir/systm (exists, not a symlink)"
    else ln -sf "$plugin/bin/systm" "$bindir/systm"; echo "launcher -> $bindir/systm"; fi
    case ":$PATH:" in *":$bindir:"*) ;; *) echo "note: add $bindir to PATH to run \`systm\` directly" ;; esac
  fi
fi

#!/usr/bin/env bash
set -euo pipefail

source scripts/lib/quiet-core-bot-e2e-instance.sh
source scripts/lib/docker-e2e-logs.sh
QUIET_CORE_PLUGINS_SWEEP_SOURCE_ONLY="${QUIET_CORE_PLUGINS_SWEEP_SOURCE_ONLY:-0}"
if [[ -z "${QUIET_CORE_ENTRY:-}" && "$QUIET_CORE_PLUGINS_SWEEP_SOURCE_ONLY" != "1" ]]; then
  QUIET_CORE_ENTRY="$(quiet_core_bot_e2e_resolve_entrypoint)"
fi
export QUIET_CORE_ENTRY
QUIET_CORE_PLUGINS_CREATED_TMP_DIR=0
if [[ -z "${QUIET_CORE_PLUGINS_TMP_DIR:-}" ]]; then
  QUIET_CORE_PLUGINS_TMP_DIR="$(mktemp -d "/tmp/quiet-core-bot-plugins.XXXXXX")"
  QUIET_CORE_PLUGINS_CREATED_TMP_DIR=1
fi
export QUIET_CORE_PLUGINS_TMP_DIR
QUIET_CORE_PLUGINS_CLI_TIMEOUT="${QUIET_CORE_PLUGINS_CLI_TIMEOUT:-180s}"
mkdir -p "$QUIET_CORE_PLUGINS_TMP_DIR"

run_plugins_quiet_core_bot_logged() {
  local label="$1"
  shift
  run_logged "$label" quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" "$@"
}

run_plugins_quiet_core_bot_capture() {
  local output_file="$1"
  shift
  quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" "$@" >"$output_file"
}

run_plugins_shell_logged() {
  local label="$1"
  shift
  local command="$1"
  run_logged "$label" quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" bash -c "$command"
}

source scripts/e2e/lib/plugins/fixtures.sh
source scripts/e2e/lib/plugins/marketplace.sh
source scripts/e2e/lib/plugins/clawhub.sh

cleanup_quiet_core_bot_plugins_sweep() {
  quiet_core_bot_plugins_cleanup_fixture_servers
  if [[ "${QUIET_CORE_PLUGINS_CREATED_TMP_DIR:-0}" = "1" ]]; then
    rm -rf "$QUIET_CORE_PLUGINS_TMP_DIR"
  fi
}

if [[ "$QUIET_CORE_PLUGINS_SWEEP_SOURCE_ONLY" = "1" ]]; then
  return 0 2>/dev/null || { cleanup_quiet_core_bot_plugins_sweep; exit 0; }
fi

trap cleanup_quiet_core_bot_plugins_sweep EXIT

quiet_core_bot_e2e_eval_test_state_from_b64 "${QUIET_CORE_TEST_STATE_SCRIPT_B64:?missing QUIET_CORE_TEST_STATE_SCRIPT_B64}"
PACKAGE_VERSION="$(node -p 'require("./package.json").version')"
QUIET_CORE_PACKAGE_ACCEPTANCE_LEGACY_COMPAT="$(node scripts/e2e/lib/package-compat.mjs "$PACKAGE_VERSION")"
export QUIET_CORE_PACKAGE_ACCEPTANCE_LEGACY_COMPAT
BUNDLED_PLUGIN_ROOT_DIR="extensions"
QUIET_CORE_PLUGIN_HOME="$HOME/.quiet-core-bot/$BUNDLED_PLUGIN_ROOT_DIR"

demo_plugin_id="demo-plugin"
demo_plugin_root="$QUIET_CORE_PLUGIN_HOME/$demo_plugin_id"
write_demo_fixture_plugin "$demo_plugin_root"
record_fixture_plugin_trust "$demo_plugin_id" "$demo_plugin_root" 1

run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-inspect.json" plugins inspect demo-plugin --runtime --json

node scripts/e2e/lib/plugins/assertions.mjs demo-plugin

echo "Testing tgz install flow..."
pack_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-pack.XXXXXX")"
pack_fixture_plugin "$pack_dir" "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-tgz.tgz" demo-plugin-tgz 0.0.1 demo.tgz "Demo Plugin TGZ"

run_plugins_quiet_core_bot_logged install-tgz plugins install "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-tgz.tgz"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins2.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins2-inspect.json" plugins inspect demo-plugin-tgz --runtime --json

node scripts/e2e/lib/plugins/assertions.mjs plugin-tgz

run_plugins_quiet_core_bot_logged uninstall-tgz plugins uninstall demo-plugin-tgz --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins2-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-tgz-removed

echo "Testing install from local folder (plugins.load.paths)..."
dir_plugin="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-dir.XXXXXX")"
write_fixture_plugin "$dir_plugin" demo-plugin-dir 0.0.1 demo.dir "Demo Plugin DIR"

run_plugins_quiet_core_bot_logged install-dir plugins install "$dir_plugin"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins3.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins3-inspect.json" plugins inspect demo-plugin-dir --runtime --json

node scripts/e2e/lib/plugins/assertions.mjs plugin-dir "$dir_plugin"

quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" plugins update demo-plugin-dir >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-dir-update.log" 2>&1
node scripts/e2e/lib/plugins/assertions.mjs plugin-dir-update-skipped

run_plugins_quiet_core_bot_logged uninstall-dir plugins uninstall demo-plugin-dir --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins3-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-dir-removed

echo "Testing install from local folder with preinstalled dependencies..."
dir_deps_plugin="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-dir-deps.XXXXXX")"
write_fixture_plugin_with_vendored_dependency "$dir_deps_plugin" demo-plugin-dir-deps 0.0.1 demo.dir.deps "Demo Plugin DIR Deps"

run_plugins_quiet_core_bot_logged install-dir-deps plugins install "$dir_deps_plugin"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-dir-deps.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-dir-deps-inspect.json" plugins inspect demo-plugin-dir-deps --runtime --json

node scripts/e2e/lib/plugins/assertions.mjs plugin-dir-deps "$dir_deps_plugin"

run_plugins_quiet_core_bot_logged uninstall-dir-deps plugins uninstall demo-plugin-dir-deps --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-dir-deps-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-dir-deps-removed

echo "Testing install from npm spec (file:)..."
file_pack_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-filepack.XXXXXX")"
write_fixture_plugin "$file_pack_dir/package" demo-plugin-file 0.0.1 demo.file "Demo Plugin FILE"

run_plugins_quiet_core_bot_logged install-file plugins install "file:$file_pack_dir/package"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins4.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins4-inspect.json" plugins inspect demo-plugin-file --runtime --json

node scripts/e2e/lib/plugins/assertions.mjs plugin-file "$file_pack_dir/package"

run_plugins_quiet_core_bot_logged uninstall-file plugins uninstall demo-plugin-file --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins4-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-file-removed

echo "Testing install and update from npm registry..."
npm_pack_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-npm-pack.XXXXXX")"
npm_dep_pack_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-npm-dep-pack.XXXXXX")"
invalid_npm_pack_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-invalid-metadata-pack.XXXXXX")"
npm_registry_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-npm-registry.XXXXXX")"
pack_fixture_plugin_with_cli_registry_dependency "$npm_pack_dir" "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-npm.tgz" demo-plugin-npm 0.0.1 demo.npm "Demo Plugin NPM" demo-npm "demo-plugin-npm:pong"
pack_fake_is_number_package "$npm_dep_pack_dir" "$QUIET_CORE_PLUGINS_TMP_DIR/is-number-7.0.0.tgz"
pack_fixture_plugin_with_invalid_extension_entry "$invalid_npm_pack_dir" "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-invalid-metadata.tgz" demo-plugin-invalid-metadata 0.0.1 demo.invalid.metadata "Demo Plugin Invalid Metadata"
start_npm_fixture_registry "@quiet-core/demo-plugin-npm" "0.0.1" "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-npm.tgz" "$npm_registry_dir" "is-number" "7.0.0" "$QUIET_CORE_PLUGINS_TMP_DIR/is-number-7.0.0.tgz" "@quiet-core/demo-plugin-invalid-metadata" "0.0.1" "$QUIET_CORE_PLUGINS_TMP_DIR/demo-plugin-invalid-metadata.tgz"

run_plugins_quiet_core_bot_logged install-npm plugins install "npm:@quiet-core/demo-plugin-npm@0.0.1"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-npm.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-npm-inspect.json" plugins inspect demo-plugin-npm --runtime --json
run_plugins_shell_logged exec-npm-plugin-cli 'node "$QUIET_CORE_ENTRY" demo-npm ping >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-npm-cli.txt"'

node scripts/e2e/lib/plugins/assertions.mjs plugin-npm

quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" plugins update demo-plugin-npm >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-npm-update.log" 2>&1
node scripts/e2e/lib/plugins/assertions.mjs plugin-npm-update

run_plugins_quiet_core_bot_logged uninstall-npm plugins uninstall demo-plugin-npm --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-npm-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-npm-removed

echo "Testing npm install rejects malformed package metadata..."
if quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" plugins install "npm:@quiet-core/demo-plugin-invalid-metadata@0.0.1" >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-invalid-quiet-core-bot-extensions.log" 2>&1; then
  cat "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-invalid-quiet-core-bot-extensions.log"
  echo "Expected malformed package metadata install to fail." >&2
  exit 1
fi
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-invalid-quiet-core-bot-extensions-list.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs invalid-quiet-core-bot-extensions

echo "Testing install from git repo and plugin CLI execution..."
git_fixture_root="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-git.XXXXXX")"
git_repo="$git_fixture_root/repo"
git_repo_url="file://$git_repo"
write_fixture_plugin_with_cli "$git_repo" demo-plugin-git 0.0.1 demo.git "Demo Plugin Git" demo-git "demo-plugin-git:pong"
git -C "$git_repo" init -q
git -C "$git_repo" config user.email "docker-e2e@quiet-core-bot.local"
git -C "$git_repo" config user.name "OpenClaw Docker E2E"
git -C "$git_repo" add -A
git -C "$git_repo" commit -qm "test fixture"
git_ref="$(git -C "$git_repo" rev-parse HEAD)"

run_plugins_quiet_core_bot_logged install-git plugins install "git:$git_repo_url@$git_ref"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-inspect.json" plugins inspect demo-plugin-git --runtime --json
run_plugins_shell_logged exec-git-plugin-cli 'node "$QUIET_CORE_ENTRY" demo-git ping >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-cli.txt"'

node scripts/e2e/lib/plugins/assertions.mjs plugin-git "$git_repo_url" "$git_ref"

run_plugins_quiet_core_bot_logged uninstall-git plugins uninstall demo-plugin-git --force
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-uninstalled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs plugin-git-removed

echo "Testing git plugin update from moving ref..."
git_update_fixture_root="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-git-update.XXXXXX")"
git_update_repo="$git_update_fixture_root/repo"
git_update_repo_url="file://$git_update_repo"
write_fixture_plugin_with_cli "$git_update_repo" demo-plugin-git-update 0.0.1 demo.git.update.v1 "Demo Plugin Git Update" demo-git-update "demo-plugin-git-update:pong-v1"
git -C "$git_update_repo" init -q
git -C "$git_update_repo" config user.email "docker-e2e@quiet-core-bot.local"
git -C "$git_update_repo" config user.name "OpenClaw Docker E2E"
git -C "$git_update_repo" checkout -qb main
git -C "$git_update_repo" add -A
git -C "$git_update_repo" commit -qm "test fixture v1"
git_update_ref_v1="$(git -C "$git_update_repo" rev-parse HEAD)"

run_plugins_quiet_core_bot_logged install-git-update plugins install "git:$git_update_repo_url@main"
write_fixture_plugin_with_cli "$git_update_repo" demo-plugin-git-update 0.0.2 demo.git.update.v2 "Demo Plugin Git Update" demo-git-update "demo-plugin-git-update:pong-v2"
git -C "$git_update_repo" add -A
git -C "$git_update_repo" commit -qm "test fixture v2"

quiet_core_bot_e2e_maybe_timeout "$QUIET_CORE_PLUGINS_CLI_TIMEOUT" node "$QUIET_CORE_ENTRY" plugins update demo-plugin-git-update >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-update.log" 2>&1
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-update.json" plugins list --json
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-update-inspect.json" plugins inspect demo-plugin-git-update --runtime --json
run_plugins_shell_logged exec-updated-git-plugin-cli 'node "$QUIET_CORE_ENTRY" demo-git-update ping >"$QUIET_CORE_PLUGINS_TMP_DIR/plugins-git-update-cli.txt"'

node scripts/e2e/lib/plugins/assertions.mjs plugin-git-updated "$git_update_ref_v1"

echo "Testing Claude bundle enable and inspect flow..."
bundle_plugin_id="claude-bundle-e2e"
bundle_root="$QUIET_CORE_PLUGIN_HOME/$bundle_plugin_id"
write_claude_bundle_fixture "$bundle_root"
record_fixture_plugin_trust "$bundle_plugin_id" "$bundle_root" 0

run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-bundle-disabled.json" plugins list --json
node scripts/e2e/lib/plugins/assertions.mjs bundle-disabled

run_plugins_quiet_core_bot_logged enable-claude-bundle plugins enable claude-bundle-e2e
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugins-bundle-inspect.json" plugins inspect claude-bundle-e2e --json
node scripts/e2e/lib/plugins/assertions.mjs bundle-inspect

echo "Testing plugin install visible after explicit restart..."
slash_install_dir="$(mktemp -d "$QUIET_CORE_PLUGINS_TMP_DIR/quiet-core-bot-plugin-slash-install.XXXXXX")"
write_fixture_plugin "$slash_install_dir" slash-install-plugin 0.0.1 demo.slash.install "Slash Install Plugin"

run_plugins_quiet_core_bot_logged install-slash-plugin plugins install "$slash_install_dir"
run_plugins_quiet_core_bot_capture "$QUIET_CORE_PLUGINS_TMP_DIR/plugin-command-install-show.json" plugins inspect slash-install-plugin --runtime --json
node scripts/e2e/lib/plugins/assertions.mjs slash-install

run_plugins_marketplace_scenario

run_plugins_clawhub_scenario

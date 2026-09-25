# Native Windows CLI and Gateway Completeness

Use this rubric when assigning category Completeness scores for the
`native-windows-cli-and-gateway` surface.

## Category Scope

- Setup: PowerShell installer, Node and package-manager bootstrap, npm global install, Packaged CLI launcher, Windows command shims, quiet-core-bot onboard, Local Gateway config, Daemon install flags, Native-vs-WSL setup boundary
- Gateway Management: quiet-core-bot gateway, Foreground runtime health/readiness, Windows-specific restart/signal, Unmanaged foreground mode, quiet-core-bot gateway install, Gateway launcher files, Scheduled Task runtime status, Startup-folder fallback, quiet-core-bot status, Windows service inspection, Post-install diagnostics
- Networking: Native Windows host binding, netsh interface portproxy, Gateway status and probe output, Loopback, LAN, and WSL boundary
- Updates: quiet-core-bot update on native Windows package, Managed Gateway stop/restart, Detached update handoff, Windows package locks

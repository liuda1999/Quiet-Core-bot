# @quiet-core/diffs-language-pack

Official extended syntax highlighting pack for the OpenClaw Diffs plugin.

The base `@quiet-core/diffs` plugin ships a curated language set. Install this package when you want the full Shiki language catalog available in rendered diff viewers and diff image/PDF output.

The pack adds highlighting for languages outside the default diffs viewer set, including Astro, Vue, Svelte, MDX, GraphQL, Terraform/HCL, Nix, Clojure, Elixir, Haskell, OCaml, Scala, Zig, Solidity, Verilog/VHDL, Fortran, MATLAB, LaTeX, Mermaid, Sass/Less/SCSS, Nginx, Apache, CSV, dotenv, INI, and diff files. See the plugin reference and Shiki language catalog for details.

## Install

```bash
quiet-core-bot plugins install @quiet-core/diffs-language-pack
```

Restart the Gateway after installing or updating the plugin.

## Use with Diffs

Install `@quiet-core/diffs` first, then install this language pack. The language pack contributes static viewer assets; it does not register a separate agent tool.

## Docs

- https://github.com/liuda1999/Quiet-Core-bot/tools/diffs
- https://github.com/liuda1999/Quiet-Core-bot/plugins/reference/diffs-language-pack

## Package

- Plugin id: `diffs-language-pack`
- Package: `@quiet-core/diffs-language-pack`
- Minimum OpenClaw host: `2026.5.27`

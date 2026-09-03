# Changelog

All notable changes to this project are documented in this file.

## 1.0.0 — 2026-09-03

Initial release.

- Interactive CLI for batch image processing (resize, format conversion, size cap, naming)
- Fresh numbered output folders per run (default `processed/`, or a custom name)
- Type-ahead folder finder with `~` expansion on submit
- Live progress spinner on stderr; final report on stdout
- Programmatic API: `squishify(options)` with validation, AbortSignal, and progress callbacks
- CLI flags: `--help` / `-h`, `--version` / `-v`
- Supported output formats: WebP, JPEG, PNG, AVIF

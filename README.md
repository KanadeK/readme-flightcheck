# README Flightcheck

[![CI](https://github.com/KanadeK/readme-flightcheck/actions/workflows/ci.yml/badge.svg)](https://github.com/KanadeK/readme-flightcheck/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/KanadeK/readme-flightcheck?display_name=tag)](https://github.com/KanadeK/readme-flightcheck/releases)
[![License](https://img.shields.io/github/license/KanadeK/readme-flightcheck)](LICENSE)

README Flightcheck is a local-first preflight for the promises a repository makes in its README. It parses install, run, test, and example commands; rehearses safe commands in a disposable copy; checks links, images, badges, and anchors; and turns the result into an evidence-led score with a repair ledger.

![A real Flightcheck report for the committed broken-links fixture](media/demo.png)

- Rehearse README commands without a shell or access to your working tree.
- Prove every score deduction with a file, line, command result, or snapshot.
- Use the same engine from a CLI or GitHub Action.

**Status:** v0.1.0. Requires Node.js 22 or 24 and npm 11.

## Quick start

```sh
npx readme-flightcheck audit . --execute
```

Or run the checked-out project against its healthy offline fixture:

```sh
npm ci
npm run build
node dist/cli.js audit fixtures/healthy --execute --format json
```

The healthy fixture produces `100 / A`; its four documented commands are executed in a temporary copy. The committed broken-links fixture produces a real `65 / D` report because it has a missing image, missing link, and stale anchor.

## What it checks

| Claim                                   | Evidence                                                                |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Install, run, test, example code blocks | Parsed command, section, README line, exit code, redacted output        |
| Relative links, images, badges, anchors | Root-contained target, file content, and GitHub-compatible heading slug |
| External HTTP(S) links                  | Optional SSRF-aware HEAD/GET check with redirect limit                  |
| Rendered page snapshots                 | Optional Playwright PNG capture and pixel comparison                    |
| README structure                        | Missing sections, missing commands, and first-screen evidence           |

## CLI

```text
readme-flightcheck audit [repository] [options]

--execute                       rehearse allowlisted README commands
--allow-command <command>       approve one additional exact command
--check-external                send HTTP(S) links to their destinations
--page-url <url>                capture a rendered page
--snapshot-output <path>        write the latest PNG snapshot
--baseline <path>               compare a PNG baseline
--format terminal|json|markdown|html|github
--output <path>                 write the chosen report format
--fail-below <score>            return exit 1 below this score (default: 80)
```

### Complete local example

```sh
node dist/cli.js audit fixtures/broken-links --execute --format html --output media/broken-links-report.html
```

Open `media/broken-links-report.html` to inspect the responsive report. It lists the three deductions and the four commands that actually ran. `npm run demo` regenerates this report, its JSON sibling, and the screenshot shown above from committed fixtures.

### GitHub Action

```yaml
- uses: KanadeK/readme-flightcheck@v0.1.0
  with:
    execute: true
    fail-below: 80
    report-path: readme-flightcheck-report.json
```

The Action writes inline annotations, a Step Summary, `score`, `grade`, `passed`, and `report-path` outputs. Upload the JSON report as a normal workflow artifact if you need to retain it.

## Safety and privacy

The default audit is local and read-only. Command rehearsal is opt-in, shell-free, restricted to a documented allowlist, run in a unique temporary copy, timeout-bound, and redacts common credentials from captured output. External checks and browser snapshots are opt-in because they contact a URL or render a page. Private, loopback, credential-bearing, and unsupported external URLs are blocked by default.

See [Privacy and security](docs/PRIVACY_AND_SECURITY.md) for the detailed threat model. A passing audit is evidence for README claims, not a substitute for dependency review, secret scanning, or human security review.

## Architecture

```text
CLI / GitHub Action
        |
application orchestration
        |
core rules <---- adapters: filesystem, command, HTTP, browser
        |
reporters: terminal, JSON, Markdown, HTML, GitHub annotations
```

The core is deterministic and has no Commander, Playwright, network, or process dependency. Adapters are isolated at the edge; reporters consume one validated audit report. More detail is in [Architecture](docs/ARCHITECTURE.md).

## Fixtures and testing

Four MIT-licensed offline fixtures are committed and score deterministically:

| Fixture                  | Expected score | Purpose                                           |
| ------------------------ | -------------: | ------------------------------------------------- |
| `fixtures/healthy`       |        100 / A | Successful command rehearsal and valid references |
| `fixtures/stale-command` |         75 / C | Real failed install command (`MODULE_NOT_FOUND`)  |
| `fixtures/broken-links`  |         65 / D | Missing image, relative link, and anchor          |
| `fixtures/hollow-readme` |         32 / F | Missing README structure and executable claims    |

```sh
npm run verify
npm run test:coverage
npm run test:e2e
npm run build
```

The test suite covers parser and scoring rules, real temporary repositories, a deterministic HTTP fixture server, Playwright snapshot comparison, CLI processes, bundled Action output, accessibility, keyboard navigation, and a 390px report layout. Coverage thresholds require at least 80% global lines and 90% core lines.

## Non-goals

- Running arbitrary README shell snippets.
- Declaring that a project is secure, maintained, or production-ready.
- Replacing full browser or integration testing for the audited repository.
- Collecting usage analytics or sending repository contents by default.

## How this differs

The public-repository sample found README linters, link checkers, and scorecards. README Flightcheck combines their useful static evidence with isolated command rehearsal, optional rendered snapshot comparison, a transparent deduction ledger, and Action annotations. The [competitor scan](docs/COMPETITOR_SCAN.md) records the sampling method and the resulting boundary.

## Roadmap

- Config-file support for shared command-policy profiles.
- Baseline management commands for visual review.
- Optional SARIF output for code-scanning pipelines.

## FAQ

**Does `--execute` run `npm install`?** Only `npm ci` with `--ignore-scripts` is allowed by the default policy; it runs in a disposable copy. Other commands need an exact explicit approval.

**Will `--check-external` scan my internal service?** No. Private and loopback hosts are blocked unless you deliberately pass `--allow-private-hosts` for a trusted fixture.

**Can I use it offline?** Yes. Parsing, local-reference checks, command rehearsal, and the four fixtures run offline. External links and page URLs are optional adapters.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), use the issue forms, and keep changes covered by a real fixture or regression test. Security reports belong in [SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE)

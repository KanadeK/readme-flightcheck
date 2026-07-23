# Architecture

README Flightcheck separates deterministic domain rules from effects:

```text
CLI / GitHub Action
        |
        v
application orchestration
        |
        +--> core: Markdown model, checks, findings, score
        |
        +--> adapters: filesystem, subprocess, HTTP, browser snapshot
        |
        +--> reporters: terminal, JSON, Markdown, HTML, GitHub annotations
```

## Dependency direction

The core accepts plain data and injected clocks/results. It does not import Commander, Playwright, GitHub Actions, the network, or process execution. Adapters translate external state into core inputs. Reporters consume the same immutable audit report so formats cannot disagree about the score.

## Trust boundaries

README Markdown, linked files, command output, HTTP responses, and rendered pages are untrusted. Paths are resolved beneath an explicit repository root. Command rehearsal copies the repository to a unique temporary directory, validates executable and argument shapes, avoids a shell, uses a reduced environment, enforces a timeout, redacts output, and removes the copy afterward.

## Determinism

The audit clock is injected. Offline checks do not depend on external APIs. Network and browser checks are optional adapters with deterministic local fixtures in tests. Scoring uses a published deduction table and stable finding codes.

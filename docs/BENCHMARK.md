# Benchmark

This is a local, reproducible developer-machine measurement, not a service-level performance claim.

## Command

```sh
npm run benchmark
```

The command builds the current checkout, then starts the built CLI ten times against the committed `fixtures/healthy` repository with `--execute --format json`. Each iteration parses the README, snapshots the fixture, creates an isolated copy, runs its four safe commands, scores the result, and exits with the healthy `100 / A` outcome. Output and network adapters are disabled.

## Recorded result

Recorded on 2026-07-27 using the local Windows Codex desktop environment, Node.js v24.18.0, npm 11.16.0, and the committed v0.1.0 fixture data:

| Iterations |      Mean |        p95 |
| ---------: | --------: | ---------: |
|         10 | 989.20 ms | 1266.18 ms |

Samples in milliseconds: 1058.53, 834.26, 945.29, 1004.12, 1047.30, 1052.89, 854.53, 766.82, 1062.10, 1266.18.

The browser snapshot and external-link adapters are intentionally excluded because they measure installed browser startup and network conditions rather than the offline command-rehearsal path.

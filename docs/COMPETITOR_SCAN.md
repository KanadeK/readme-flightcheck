# Public repository scan

Scan date: 2026-07-23 (UTC metadata from GitHub). This is a reproducible sample, not a claim of global uniqueness.

## Method

The authenticated account `KanadeK` ran these repository searches:

```text
README Flightcheck in:name
readme-flightcheck in:name
README validation
README checker
markdown link checker
readme lint
documentation linter
```

Both exact-name searches returned no repositories. Search metadata came from `gh search repos` and `gh repo view`; the selected repositories' public READMEs were inspected through GitHub's page or contents API. Stars and update times are snapshots and will drift.

## Most relevant sampled repositories

| Repository                                                                                              | Stars | Last push (UTC) | Main function                                                                          | Overlap with README Flightcheck                                                                                                                           |
| ------------------------------------------------------------------------------------------------------- | ----: | --------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [mxyooR/README-checker](https://github.com/mxyooR/README-checker)                                       |     1 | 2025-12-30      | Static checks for environment variables, links, manifest-backed commands, and metadata | Strongest neighbor: relative links, anchors, and command claims; it checks declarations/file presence rather than rehearsing commands in an isolated copy |
| [wuser-lab/meridian](https://github.com/wuser-lab/meridian)                                             |     1 | 2026-06-25      | Full-stack structure, readability, inclusive-language, and example scoring             | Shares structure scoring; depends on a web/database stack and does not validate executable claims or screenshots                                          |
| [stef41/readme-lint-action](https://github.com/stef41/readme-lint-action)                               |     1 | 2026-04-10      | GitHub Action for required sections, length, badges, examples, and a score             | Shares first-screen completeness and scoring; does not exercise commands or compare snapshots                                                             |
| [lycheeverse/lychee](https://github.com/lycheeverse/lychee)                                             | 3,778 | 2026-07-20      | High-performance link checking across Markdown, HTML, sites, and other formats         | Much deeper external-link coverage; no README claim model, command rehearsal, screenshot evidence, or holistic score                                      |
| [lycheeverse/lychee-action](https://github.com/lycheeverse/lychee-action)                               |   499 | 2026-07-09      | GitHub Action wrapper for Lychee                                                       | Shares Action delivery and broken-link annotations only                                                                                                   |
| [tcort/markdown-link-check](https://github.com/tcort/markdown-link-check)                               |   712 | 2026-07-20      | CLI for live/dead hyperlinks in Markdown                                               | Shares link validation only                                                                                                                               |
| [JustinBeckwith/linkinator](https://github.com/JustinBeckwith/linkinator)                               | 1,241 | 2026-07-23      | Site/local-file crawler for broken links with CI integration                           | Shares links and CI output; targets crawl breadth rather than README truthfulness                                                                         |
| [remarkjs/remark-lint](https://github.com/remarkjs/remark-lint)                                         | 1,040 | 2026-01-05      | Extensible Markdown style rules                                                        | Shares Markdown parsing; checks style rather than repository-backed claims                                                                                |
| [DavidAnson/markdownlint](https://github.com/DavidAnson/markdownlint)                                   | 6,221 | 2026-07-23      | CommonMark/Markdown style library and linter                                           | Shares local Markdown analysis only                                                                                                                       |
| [github/super-linter](https://github.com/github/super-linter)                                           |   150 | 2026-07-03      | GitHub Action aggregating many source-code linters                                     | Shares CI delivery and Markdown linting as one component; not README-specific                                                                             |
| [ruzickap/action-my-markdown-link-checker](https://github.com/ruzickap/action-my-markdown-link-checker) |    21 | 2026-07-21      | GitHub Action for Markdown link checks                                                 | Shares Action delivery and link checks only                                                                                                               |

## Decision and differentiation

No sampled active project used the exact name or slug, so the project remains **README Flightcheck** / `readme-flightcheck`.

No sampled project overlaps more than approximately 70% of the MVP. The closest static checker makes broad codebase-consistency checks; README Flightcheck deliberately narrows its promise to evidence that a maintainer can reproduce:

1. Extract install/run/test/example claims from README structure.
2. Rehearse approved commands without a shell in an isolated copy and preserve real exit status.
3. Validate local links, images, badges, anchors, and optional page snapshots.
4. Produce one transparent deduction ledger across CLI, JSON, Markdown, HTML, and GitHub annotations.

The README may therefore state only that this public sample found no same-name, highly isomorphic active project.

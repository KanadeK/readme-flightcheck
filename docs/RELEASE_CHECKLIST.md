# v0.1.0 release checklist

## Product

- [ ] Four committed fixture repositories produce their documented distinct scores.
- [ ] A failing install command returns a non-zero CLI status.
- [ ] Link, image, badge, anchor, and optional snapshot paths use real adapters.
- [ ] Every reporter derives from the same finding and scoring model.

## Quality

- [ ] Formatting, linting, strict type checking, unit, integration, and Playwright E2E pass.
- [ ] Core line coverage is at least 80%; critical domain modules are at least 90%.
- [ ] Demo and benchmark outputs were regenerated from v0.1.0.
- [ ] npm tarball, Action bundle, CLI bundle, report bundle, and SHA256SUMS exist.
- [ ] The npm tarball installs and runs in a clean temporary directory.

## Security and repository hygiene

- [ ] No secret-like values, private data, empty implementation markers, caches, or environment files are tracked or packaged.
- [ ] The worktree is clean and package, Action, changelog, and tag versions agree.
- [ ] Author and committer are the authenticated GitHub user; no `Co-authored-by` trailer exists.

## Online release

- [ ] Public repository metadata and topics are correct.
- [ ] CI, security, release, and Pages workflows are green.
- [ ] `main` and annotated `v0.1.0` point at the intended commit.
- [ ] Release assets download and match published SHA-256 values.
- [ ] GitHub contributors show only expected human authors.

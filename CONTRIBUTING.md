# Contributing

Thank you for improving README Flightcheck.

## Before opening a change

1. Discuss broad product or security changes in an issue.
2. Keep core analysis deterministic and independent from network or browser adapters.
3. Add a regression test for every corrected defect.
4. Do not weaken a check merely to make CI pass.

## Local setup

```sh
npm ci
npm run verify
```

Use Node.js 22 or 24. Commit `package-lock.json` whenever dependencies change.

## Pull requests

- Keep the diff focused and explain user-visible behavior.
- Include success, boundary, and failure-path tests.
- Never commit credentials, private repository contents, generated caches, or personal data.
- Use Conventional Commit-style subjects without `Co-authored-by` trailers.

By contributing, you agree that your contribution is licensed under the MIT License.

# README Flightcheck

README Flightcheck is a local-first quality gate for the claims repositories make in their READMEs. It is designed to parse install, run, test, and example blocks; rehearse approved commands in an isolated copy; verify links and screenshots; and explain every point in its score.

This checkout starts with the public-project contract, dependency policy, architecture boundaries, and automated quality gate. Functional milestones are committed separately so each layer can be reviewed against the contract before the v0.1.0 release.

## Product boundaries

- Repository contents are processed locally by default.
- Command execution is opt-in, allowlisted, shell-free, and restricted to a temporary repository copy.
- Network link checks and browser snapshots are opt-in.
- A passing score never replaces human security review.

## Development

Requires Node.js 22 or 24 and npm 11.

```sh
npm ci
npm run verify
```

See [Architecture](docs/ARCHITECTURE.md), [Privacy and security](docs/PRIVACY_AND_SECURITY.md), and the [public-repository scan](docs/COMPETITOR_SCAN.md).

## License

[MIT](LICENSE)

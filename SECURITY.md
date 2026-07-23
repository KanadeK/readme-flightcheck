# Security policy

## Supported version

Security fixes are provided for the latest released minor version. Before v1.0, users should upgrade to the newest release for fixes.

## Reporting a vulnerability

Use the repository's private GitHub Security Advisory form. Do not open a public issue containing exploit details, credentials, private README content, or command output with secrets.

Include the affected version, operating system, minimal reproduction, impact, and any proposed mitigation. The maintainer will acknowledge a complete report within seven days and coordinate disclosure after a fix is available.

## Security boundary

README content is untrusted input. Execution is opt-in and limited to explicitly supported executable/argument shapes in a temporary copy. This reduces risk but is not an operating-system sandbox. Review commands before enabling execution on untrusted repositories.

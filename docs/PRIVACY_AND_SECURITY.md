# Privacy and security

## Data flow

By default, README Flightcheck reads one local repository and writes only the requested report. It does not upload repository contents or collect telemetry.

Optional external-link checks send the linked URL to its destination. Optional browser snapshots load only the URL supplied by the operator. Both features are off unless explicitly requested.

## Command rehearsal

Command blocks are never passed to a shell. The runner accepts only documented executable and argument forms, rejects redirects, pipes, command substitution, environment assignment, absolute paths, and parent-directory traversal, and runs in a disposable repository copy with a reduced environment and hard timeout.

This is defense in depth, not a VM or kernel sandbox. Do not enable execution for an untrusted repository without reviewing the extracted commands.

## Sensitive values

Reports redact common access-token, authorization-header, private-key, and credential-assignment patterns. The process runner does not forward the full parent environment. Operators must still review reports before publishing them.

## Retention

Temporary copies are removed after each run. Reports and snapshots remain only at operator-selected output paths.

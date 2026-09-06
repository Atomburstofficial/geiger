# Security

## Reporting a vulnerability

Email security@atomburst.io. We aim to acknowledge within 2 business days.
Please do not open public issues for vulnerabilities.

## What geiger does and does not do

- Read-only by design: the only write is the `--json` file you name.
- No network calls, no telemetry, no update checks. The published package
  has zero runtime dependencies.
- Secret values found in configs are never printed, logged, or serialized —
  only key names, file paths, and shape labels. A redaction pass runs on all
  output and the test suite enforces this guarantee.

## Scope notes for researchers

Findings we especially care about: any path where a secret value could reach
output; any write outside the explicit --json target; any code path that
initiates network traffic; parser crashes on hostile config files.

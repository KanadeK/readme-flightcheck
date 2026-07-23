# Deterministic fixture repositories

These synthetic repositories are authored for README Flightcheck and distributed under the repository's MIT License. They contain no third-party data or network dependency.

When command rehearsal is enabled and external links are left offline, v0.1.0 expects:

| Fixture         | Expected score | Evidence                                                                         |
| --------------- | -------------: | -------------------------------------------------------------------------------- |
| `healthy`       |            100 | All structure, references, images, anchors, and four commands pass               |
| `stale-command` |             75 | The documented install script is absent and exits non-zero                       |
| `broken-links`  |             65 | One missing file, one missing anchor, and one missing image                      |
| `hollow-readme` |             32 | No substantive intro, commands, screenshot, badge, version, or security boundary |

The fixtures are intentionally small so tests can copy and execute them without package installation or internet access.

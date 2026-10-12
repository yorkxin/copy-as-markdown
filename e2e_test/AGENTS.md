# Selenium test guidance for agents

Read [CLAUDE.md](../CLAUDE.md) and [DEVELOPMENT.md](../DEVELOPMENT.md) first.
[README.md](README.md) contains the operator commands.

- Run Selenium e2e tests only through the Docker harness, including individual
  tests. They use the real clipboard and native keyboard/context-menu input.
- Use the current pytest `junit.xml` as the authoritative result. Report passed,
  failed and skipped counts separately; do not treat skipped tests as validated.
- Check `browser.log` and `environment.log` before claiming a browser version or
  architecture was tested. Keep resolver/unit/controlled-stub checks distinct
  from actual browser runtime verification.
- The local shared-image harness writes `metadata.json` with channel-check status. An offline `unverified` run
  validates the installed browser, not its agreement with the current release channel.
- The ESR profile tracks Mozilla’s primary `FIREFOX_ESR` branch; it uses a real
  ESR binary at `/opt/firefox-esr/firefox`, alongside Stable at `/opt/firefox/firefox`
  and CfT in the shared environment image. Check only the selected profile's
  channels when reusing it; rebuilding refreshes all three browser installations.
  Additional supported branches during ESR transitions are a separate
  scope decision. Do not introduce cross-architecture emulation or special
  handling of shell platform overrides.

For harness changes, inspect [docker_e2e.py](../docker/selenium-ci/docker_e2e.py),
[run-selenium.sh](../docker/selenium-ci/run-selenium.sh) and
[conftest.py](conftest.py) for existing behavior instead of duplicating its
implementation in documentation. Run the resolver and host-flow checks:

```sh
python3 -m unittest discover -s docker/selenium-ci -p 'test_*.py'
```

Browser version overrides belong to the image build tool,
[build_image.py](../docker/selenium-ci/build_image.py). Keep the normal test
interface limited to `PROFILE`, `BROWSER` and pytest arguments.

CI uses [run-official.sh](../docker/selenium-ci/run-official.sh) inside official
Firefox/Chromium images, with test extensions downloaded from the same run's
build artifact. Tests run as `seluser` with distro-compatible Python / APT GI, on the
same Xvfb and D-Bus session as the browser. ESR is installed from Mozilla APT
using the primary channel's major, rather than APT's potentially newer next ESR.
There is no CI image build or remote freshness check. Preserve actual browser
version checks: Chromium requires matching driver major; CfT requires its exact
browser/driver pair. Older local geckodriver needs Firefox's system-access
argument; newer geckodriver requires its own `--allow-system-access` flag.
The official Chromium image mixes Debian sid packages into its base and removes
the Debian APT source. Restore that source for matching GI/GLib packages; do not
downgrade browser libraries to satisfy Ubuntu's GI dependencies. Firefox uses
Ubuntu's Python 3.12 for its GI bindings.
Replace the Chromium image's Ubuntu PPA Python with the distro packages before
installing GI: its monolithic files otherwise conflict with Debian's minimal
Python packages. These changes are limited to the disposable CI container.
When reproducing CI, include GitHub's root-owned `HOME=/github/home`. Let
`runuser` reset HOME for `seluser`; preserving it prevents browsers from starting.

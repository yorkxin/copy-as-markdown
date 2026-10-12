# Selenium test guidance for agents

Read [CLAUDE.md](../CLAUDE.md) and [DEVELOPMENT.md](../DEVELOPMENT.md) first.
[README.md](README.md) contains the operator commands.

- Run Selenium e2e tests only through the Docker harness, including individual
  tests. They use the real clipboard and native keyboard/context-menu input.
- Use the current pytest `junit.xml` as the authoritative result. Report passed,
  failed and skipped counts separately; do not treat skipped tests as validated.
- Check `run.log` and `environment.log` before claiming a browser version or
  architecture was tested. Keep resolver/unit/controlled-stub checks distinct
  from actual browser runtime verification.
- Do not introduce cross-architecture emulation or special handling of platform overrides.

Local runs and CI share [run-official.sh](../docker/selenium-ci/run-official.sh).
The local launcher builds extensions once and copies test inputs into disposable
containers; it must not modify source ownership. Resolver checks are independent
of browser runtime validation:

```sh
python3 -m unittest discover -s docker/selenium-ci -p 'test_*.py'
```

CI downloads test extensions from the same run’s build artifact. Tests run as
`seluser` with distro-compatible Python / APT GI, on the same Xvfb and D-Bus
session as the browser. `FIREFOX_ESR_MAJOR` pins its ESR
branch; resolve the latest patch from Mozilla ESR metadata, download the official
archive and verify SHA256SUMS. Never silently switch the pinned major; missing channel
metadata requires revisiting the pin.
There is no CI image build or remote freshness check. Preserve actual browser
version checks: Chromium requires matching driver major. Use geckodriver’s `--allow-system-access` flag for extension-page navigation.
The official Chromium image mixes Debian sid packages into its base and removes
the Debian APT source. Restore that source for matching GI/GLib packages; do not
downgrade browser libraries to satisfy Ubuntu's GI dependencies. Firefox uses
Ubuntu's Python 3.12 for its GI bindings.
Replace the Chromium image's Ubuntu PPA Python with the distro packages before
installing GI: its monolithic files otherwise conflict with Debian's minimal
Python packages. These changes are limited to the disposable CI container.
When reproducing CI, include GitHub's root-owned `HOME=/github/home`. Let
`runuser` reset HOME for `seluser`; preserving it prevents browsers from starting.

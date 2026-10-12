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
- `metadata.json` records the channel-check status. An offline `unverified` run
  validates the installed browser, not its agreement with the current release channel.
- The ESR profile tracks Mozilla’s primary `FIREFOX_ESR` branch; it uses a real
  ESR binary. Additional supported branches during ESR transitions are a separate
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

"""Controlled host-flow stubs. These checks do not validate browser runtime."""
import json
import os
from pathlib import Path
import shutil
import signal
import time
import subprocess
import sys
import tempfile
import unittest


class DockerHarnessTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        scripts = self.root / "docker/selenium-ci"
        scripts.mkdir(parents=True)
        self.harness = scripts / "docker-e2e.sh"
        shutil.copy(Path(__file__).with_name("docker-e2e.sh"), self.harness)
        resolver = '''import json, os, sys
name = os.path.basename(__file__)
if os.environ.get("FAIL_RESOLVE") == name:
    sys.exit("controlled metadata failure")
requested = sys.argv[1]
version = ("157.0" if requested == "latest" else "139.0.4" if requested == "139" else requested) if "firefox" in name else ("154.0.8037.92" if requested in ("latest", "154") else requested)
print(json.dumps({"requested": requested, "version": version, "chrome_url": "https://example.invalid/chrome", "chromedriver_url": "https://example.invalid/driver"}))
'''
        for name in ("resolve_firefox.py", "resolve_cft.py"):
            (scripts / name).write_text(resolver)
        self.calls = self.root / "calls.jsonl"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        docker = self.bin / "docker"
        docker.write_text(f"#!{sys.executable}\n" + '''import json, os, sys
args = sys.argv[1:]
with open(os.environ["CALLS"], "a") as log:
    log.write(json.dumps(args) + "\\n")
if args[0] == "version": print("arm64")
if args[:2] == ["image", "inspect"]: print("controlled-image")
if args[0] == "run" and os.environ.get("WAIT_RUN"):
    import time
    time.sleep(60)
if args[0] in ("build", "run"):
    browser = "firefox" if any("selenium:firefox-" in a for a in args) else "cft"
    sys.exit(int(os.environ.get(args[0].upper() + "_" + browser.upper(), "0")))
''')
        docker.chmod(0o755)

    def run_harness(self, env=None, args=()):
        task_env = {k: v for k, v in os.environ.items() if k not in
                    ("SELENIUM_BROWSER", "FIREFOX_VERSION", "CFT_VERSION", "DOCKER_DEFAULT_PLATFORM")}
        task_env.update({"PATH": str(self.bin) + os.pathsep + os.environ["PATH"], "CALLS": str(self.calls)})
        task_env.update(env or {})
        result = subprocess.run(["bash", str(self.harness), *args], env=task_env,
                                capture_output=True, text=True, timeout=10)
        calls = [json.loads(line) for line in self.calls.read_text().splitlines()] if self.calls.exists() else []
        self.runs = [call for call in calls if call[0] == "run"]
        return result

    def test_default_runs_both_latest_and_preserves_arguments(self):
        result = self.run_harness(args=("-k", "link or image"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(self.runs), 2)
        self.assertIn("copy-as-markdown-selenium:firefox-157.0", self.runs[0])
        self.assertIn("copy-as-markdown-selenium:cft-154.0.8037.92", self.runs[1])
        self.assertEqual(self.runs[1][-2:], ["-k", "link or image"])
        self.assertIn("Chrome for Testing 154.0.8037.92: PASSED", result.stdout)

    def test_explicit_browser_excludes_the_other(self):
        result = self.run_harness({"SELENIUM_BROWSER": "cft"})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(len(self.runs), 1)
        self.assertIn("copy-as-markdown-selenium:cft-154.0.8037.92", self.runs[0])

    def test_version_does_not_implicitly_select_browser(self):
        result = self.run_harness({"FIREFOX_VERSION": "139"})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(len(self.runs), 2)
        self.assertIn("copy-as-markdown-selenium:firefox-139.0.4", self.runs[0])

    def test_collection_failure_still_runs_second_browser(self):
        result = self.run_harness({"RUN_FIREFOX": "2"})
        self.assertEqual(result.returncode, 2)
        self.assertEqual(len(self.runs), 2)
        self.assertIn("Chrome for Testing 154.0.8037.92: PASSED", result.stdout)

    def test_first_test_failure_does_not_hide_second_success(self):
        result = self.run_harness({"RUN_FIREFOX": "1"})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(self.runs), 2)
        self.assertIn("Firefox 157.0: FAILED", result.stdout)
        self.assertIn("Chrome for Testing 154.0.8037.92: PASSED", result.stdout)

    def test_second_test_failure_is_not_hidden(self):
        result = self.run_harness({"RUN_CFT": "1"})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(self.runs), 2)

    def test_build_failure_still_runs_other_browser(self):
        result = self.run_harness({"BUILD_FIREFOX": "7"})
        self.assertEqual(result.returncode, 7)
        self.assertEqual(len(self.runs), 1)
        self.assertIn("Firefox 157.0: FAILED", result.stdout)

    def test_resolution_failure_retains_identity_and_runs_other_browser(self):
        result = self.run_harness({"FAIL_RESOLVE": "resolve_firefox.py"})
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(self.runs), 1)
        self.assertIn("Firefox requested latest (unresolved): FAILED", result.stdout)

    def test_empty_subset_remains_failure(self):
        result = self.run_harness({"RUN_CFT": "5"})
        self.assertEqual(result.returncode, 5)
        self.assertIn("No tests matched for Chrome for Testing", result.stderr)

    def test_interruption_does_not_start_other_browser(self):
        result = self.run_harness({"RUN_FIREFOX": "130"})
        self.assertEqual(result.returncode, 130)
        self.assertEqual(len(self.runs), 1)

    def test_invalid_selector_never_calls_docker(self):
        result = self.run_harness({"SELENIUM_BROWSER": "unknown"})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.calls.exists())

    def test_ctrl_c_stops_scheduling(self):
        task_env = dict(os.environ)
        for key in ("SELENIUM_BROWSER", "FIREFOX_VERSION", "CFT_VERSION", "DOCKER_DEFAULT_PLATFORM"):
            task_env.pop(key, None)
        task_env.update({"PATH": str(self.bin) + os.pathsep + os.environ["PATH"],
                         "CALLS": str(self.calls), "WAIT_RUN": "1"})
        process = subprocess.Popen(["bash", str(self.harness)], env=task_env,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, start_new_session=True)
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                if self.calls.exists() and any(json.loads(line)[0] == "run"
                                               for line in self.calls.read_text().splitlines()):
                    break
                time.sleep(0.02)
            else:
                self.fail("Controlled Docker run did not start")
            os.killpg(process.pid, signal.SIGINT)
            _, stderr = process.communicate(timeout=5)
            self.assertEqual(process.returncode, 130, stderr)
            calls = [json.loads(line) for line in self.calls.read_text().splitlines()]
            self.assertEqual(sum(call[0] == "run" for call in calls), 1)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()

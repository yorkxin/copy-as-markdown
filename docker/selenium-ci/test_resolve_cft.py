"""Offline checks for version/platform selection; not browser runtime coverage."""
from copy import deepcopy
import unittest

from resolve_cft import resolve


class ResolveCftTest(unittest.TestCase):
    def setUp(self):
        self.version = "154.0.8037.92"
        self.release = {"version": self.version, "downloads": {
            artifact: [{"platform": "linux64", "url":
                        f"https://storage.googleapis.com/chrome-for-testing-public/"
                        f"{self.version}/linux64/{artifact}-linux64.zip"}]
            for artifact in ("chrome", "chromedriver")
        }}

    def test_latest_selects_stable_and_records_timestamp(self):
        metadata = {"timestamp": "snapshot", "channels": {
            "Stable": self.release, "Beta": {"version": "155.0.1.0"}}}
        result = resolve(metadata, "latest", "linux64")
        self.assertEqual(result["version"], self.version)
        self.assertEqual(result["timestamp"], "snapshot")

    def test_version_selection_does_not_require_platform_downloads(self):
        release = {"version": self.version}
        result = resolve({"channels": {"Stable": release}}, "latest")
        self.assertEqual(result["version"], self.version)
        self.assertNotIn("platform", result)
        self.assertNotIn("chrome_url", result)

    def test_exact_version_cannot_silently_select_another_release(self):
        with self.assertRaisesRegex(ValueError, "metadata contains"):
            resolve(self.release, "116.0.5845.96", "linux64")

    def test_platform_requires_both_browser_and_driver(self):
        release = deepcopy(self.release)
        release["downloads"]["chromedriver"] = []
        with self.assertRaisesRegex(ValueError, "chromedriver archive"):
            resolve(release, self.version, "linux64")

    def test_unavailable_arm_archive_fails_without_amd64_fallback(self):
        with self.assertRaisesRegex(ValueError, "linux-arm64"):
            resolve(self.release, self.version, "linux-arm64")

    def test_driver_url_must_match_selected_release(self):
        release = deepcopy(self.release)
        release["downloads"]["chromedriver"][0]["url"] = (
            "https://storage.googleapis.com/chrome-for-testing-public/116.0.5845.96/linux64/driver.zip")
        with self.assertRaisesRegex(ValueError, "Unexpected chromedriver URL"):
            resolve(release, self.version, "linux64")

    def test_major_selects_matching_milestone(self):
        metadata = {"timestamp": "snapshot", "milestones": {"154": self.release}}
        result = resolve(metadata, "154", "linux64")
        self.assertEqual(result["requested"], "154")
        self.assertEqual(result["version"], self.version)

    def test_major_cannot_select_another_major(self):
        with self.assertRaisesRegex(ValueError, "major 116"):
            resolve({"milestones": {"116": self.release}}, "116", "linux64")

    def test_unknown_major_fails(self):
        with self.assertRaisesRegex(ValueError, "Unknown CfT major"):
            resolve({"milestones": {}}, "999", "linux64")

"""Offline release selection checks, separate from browser runtime validation."""
import unittest
from resolve_firefox import ReleaseDirectories, select_major, channel_version


class ResolveFirefoxTest(unittest.TestCase):
    def test_pinned_esr_selects_matching_primary_or_next_branch(self):
        channels = {"FIREFOX_ESR": "140.17.0esr", "FIREFOX_ESR_NEXT": "153.4.0esr"}
        for major, expected in (("140", "140.17.0esr"), ("153", "153.4.0esr")):
            with self.subTest(major=major):
                self.assertEqual(channel_version(channels, "esr:" + major), expected)

    def test_pinned_esr_selects_latest_patch_and_excludes_non_esr(self):
        channels = {"FIREFOX_ESR": "140.0.9esr", "FIREFOX_ESR_NEXT": "140.0.10esr",
                    "FIREFOX_ESR_INVALID": "140.18.0", "LATEST_FIREFOX_VERSION": "140.19.0"}
        self.assertEqual(channel_version(channels, "esr:140"), "140.0.10esr")

    def test_unavailable_or_invalid_esr_major_never_switches_branches(self):
        for requested in ("esr:140", "esr:0", "esr:next"):
            with self.subTest(requested=requested), self.assertRaises(ValueError):
                channel_version({"FIREFOX_ESR": "153.4.0esr"}, requested)

    def test_esr_uses_official_primary_channel_not_next_branch(self):
        self.assertEqual(channel_version({"FIREFOX_ESR": "140.17.0esr",
                                          "FIREFOX_ESR_NEXT": "153.4.0esr"}, "esr"), "140.17.0esr")

    def test_esr_rejects_ordinary_release_and_beta(self):
        for version in ("140.17.0", "153.0b1", ""):
            with self.subTest(version=version), self.assertRaises(ValueError):
                channel_version({"FIREFOX_ESR": version}, "esr")

    def test_stable_rejects_esr(self):
        with self.assertRaises(ValueError):
            channel_version({"LATEST_FIREFOX_VERSION": "140.17.0esr"}, "latest")

    def test_numeric_sort_and_other_major_exclusion(self):
        versions = {"139.0.2": "date", "139.0.10": "date", "140.0": "date"}
        self.assertEqual(select_major("139", {"139.0": "date"}, versions,
                                      {"139.0", *versions}), "139.0.10")

    def test_first_release_when_no_patch_exists(self):
        self.assertEqual(select_major("157", {"157.0": "date"}, {}, {"157.0"}), "157.0")

    def test_esr_numbers_in_history_do_not_override_ordinary_release(self):
        history = {"140.0.4": "date", "140.17.0": "date", "140.0b8": "date"}
        directories = ReleaseDirectories()
        directories.feed('<a href="140.0.4/">release</a><a href="140.17.0esr/">ESR</a>'
                         '<a href="140.0b8/">beta</a>')
        self.assertEqual(select_major("140", {"140.0": "date"}, history,
                                      directories.versions), "140.0.4")

    def test_unknown_major_fails_without_fallback(self):
        with self.assertRaisesRegex(ValueError, "major 999"):
            select_major("999", {"139.0": "date"}, {}, {"139.0"})

    def test_official_archive_root_relative_links(self):
        directories = ReleaseDirectories()
        directories.feed('<a href="/pub/firefox/releases/139.0.4/">release</a>'
                         '<a href="/pub/firefox/releases/140.17.0esr/">ESR</a>')
        self.assertEqual(directories.versions, {"139.0.4"})

"""Offline release selection checks, separate from browser runtime validation."""
import unittest
from resolve_firefox import channel_version


class ResolveFirefoxTest(unittest.TestCase):
    def test_pinned_esr_selects_matching_primary_or_next_branch(self):
        channels = {"FIREFOX_ESR": "140.17.0esr", "FIREFOX_ESR_NEXT": "153.4.0esr"}
        for major, expected in (("140", "140.17.0esr"), ("153", "153.4.0esr")):
            with self.subTest(major=major):
                self.assertEqual(channel_version(channels, major), expected)

    def test_pinned_esr_selects_latest_patch_and_excludes_non_esr(self):
        channels = {"FIREFOX_ESR": "140.0.9esr", "FIREFOX_ESR_NEXT": "140.0.10esr",
                    "FIREFOX_ESR_INVALID": "140.18.0", "LATEST_FIREFOX_VERSION": "140.19.0"}
        self.assertEqual(channel_version(channels, "140"), "140.0.10esr")

    def test_unavailable_or_invalid_esr_major_never_switches_branches(self):
        for requested in ("140", "0", "next"):
            with self.subTest(requested=requested), self.assertRaises(ValueError):
                channel_version({"FIREFOX_ESR": "153.4.0esr"}, requested)

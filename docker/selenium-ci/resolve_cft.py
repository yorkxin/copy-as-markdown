"""Resolve an exact CfT browser/driver pair before Docker's download cache."""
import json
import re
import sys
from urllib.request import urlopen

METADATA_ROOT = "https://googlechromelabs.github.io/chrome-for-testing"


def resolve(metadata, requested, platform):
    if requested == "latest":
        release = metadata["channels"]["Stable"]
    elif re.fullmatch(r"[1-9]\d*", requested):
        if requested not in metadata["milestones"]:
            raise ValueError(f"Unknown CfT major: {requested}")
        release = metadata["milestones"][requested]
    else:
        release = metadata
    version = release["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+\.\d+", version):
        raise ValueError(f"Invalid CfT version: {version}")
    if requested.isdigit() and version.split(".")[0] != requested:
        raise ValueError(f"Requested CfT major {requested}, metadata contains {version}")
    if requested != "latest" and not requested.isdigit() and version != requested:
        raise ValueError(f"Requested CfT {requested}, metadata contains {version}")
    result = {"requested": requested, "version": version, "platform": platform, "timestamp": metadata.get("timestamp")}
    for artifact in ("chrome", "chromedriver"):
        matches = [item for item in release["downloads"][artifact] if item["platform"] == platform]
        if len(matches) != 1:
            raise ValueError(f"CfT {version}: no unique {artifact} archive for {platform}")
        url = matches[0]["url"]
        expected = f"https://storage.googleapis.com/chrome-for-testing-public/{version}/{platform}/"
        if not url.startswith(expected):
            raise ValueError(f"Unexpected {artifact} URL: {url}")
        result[artifact + "_url"] = url
    return result


def main():
    requested, platform = sys.argv[1:]
    if requested == "latest":
        filename = "last-known-good-versions-with-downloads.json"
    elif re.fullmatch(r"[1-9]\d*", requested):
        filename = "latest-versions-per-milestone-with-downloads.json"
    elif re.fullmatch(r"[1-9]\d*\.\d+\.\d+\.\d+", requested):
        filename = f"{requested}.json"
    else:
        raise ValueError("CFT_VERSION must be latest, a positive major, or an exact four-part version")
    metadata_url = f"{METADATA_ROOT}/{filename}"
    with urlopen(metadata_url, timeout=30) as response:
        metadata = json.load(response)
    result = resolve(metadata, requested, platform)
    result["metadata_url"] = metadata_url
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        sys.exit(f"CfT resolution failed: {error}")

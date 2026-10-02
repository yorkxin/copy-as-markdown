"""Build/reuse a two-browser environment and run the current checkout once."""
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "docker/selenium-ci"
MINIMUM = {"firefox": "139.0", "cft": "116.0.5845.96"}


def capture(command):
    return subprocess.check_output(command, text=True).strip()


def run(command, log, stream=False):
    if not stream:
        print(f"[Docker {command[1]}] Details: {log}", flush=True)
    with log.open("a") as output:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                   text=True, bufsize=1)
        try:
            for line in process.stdout:
                if stream:
                    print(line, end="", flush=True)
                output.write(line)
            code = process.wait()
        except BaseException:
            process.terminate()
            process.wait()
            raise
    if code:
        if not stream:
            print("".join(log.read_text().splitlines(keepends=True)[-30:]), file=sys.stderr)
        raise subprocess.CalledProcessError(code, command)


def image_versions(image):
    inspection = subprocess.run(["docker", "image", "inspect", image], capture_output=True, text=True)
    if inspection.returncode:
        return None
    info = json.loads(inspection.stdout)[0]
    env = dict(item.split("=", 1) for item in info["Config"]["Env"] if "=" in item)
    return {"firefox": env["FIREFOX_VERSION"], "cft": env["CFT_VERSION"]}


def check_stable_majors(installed, stable):
    for browser, version in installed.items():
        current = stable[browser]["version"]
        if version.split(".")[0] != current.split(".")[0]:
            raise ValueError(f"{browser}: image {version}, current Stable {current}; major mismatch. "
                             "Rebuild with SELENIUM_REBUILD=1 (or update SELENIUM_IMAGE).")


def resolve(browser, requested, platform):
    if browser == "cft":
        platform = {"linux/amd64": "linux64", "linux/arm64": "linux-arm64",
                    "linux/arm64/v8": "linux-arm64"}[platform]
    return json.loads(capture([sys.executable, str(SCRIPTS / f"resolve_{browser}.py"),
                               requested, platform]))


def main():
    selector = os.environ.get("SELENIUM_BROWSER", "all")
    if selector not in ("all", "firefox", "cft"):
        raise ValueError(f"Unsupported Selenium browser: {selector}")
    overrides = any(name in os.environ for name in ("FIREFOX_VERSION", "CFT_VERSION"))
    profile = os.environ.get("SELENIUM_PROFILE", "custom" if overrides else "latest")
    if profile not in ("minimum", "latest", "custom"):
        raise ValueError(f"Unsupported Selenium profile: {profile}")
    if overrides and profile != "custom":
        raise ValueError("Version overrides require SELENIUM_PROFILE=custom (or omit the profile)")
    results = ROOT / f"test-results/selenium-{profile}-{selector}"
    results.mkdir(parents=True, exist_ok=True)
    results.chmod(0o1777)
    for name in ("junit.xml", "browser.log", "run.log", "build.log", "metadata.json", "environment.log"):
        (results / name).unlink(missing_ok=True)
    platform = os.environ.get("DOCKER_DEFAULT_PLATFORM") or "linux/" + capture(
        ["docker", "version", "--format", "{{.Server.Arch}}"])
    if platform not in ("linux/amd64", "linux/arm64", "linux/arm64/v8"):
        raise ValueError(f"Unsupported Docker platform: {platform}")
    supplied_image = os.environ.get("SELENIUM_IMAGE")
    image = supplied_image or f"copy-as-markdown-selenium-env:{profile}-{platform.split('/')[1]}"
    installed = image_versions(image) if profile != "custom" or supplied_image else None
    if supplied_image and installed is None:
        run(["docker", "pull", "--platform", platform, image], results / "build.log")
        installed = image_versions(image)
        if installed is None:
            raise ValueError(f"Cannot inspect browser versions in {image}")
    stable = {b: resolve(b, "latest", platform) for b in MINIMUM} if profile == "latest" else {}
    rebuild = os.environ.get("SELENIUM_REBUILD") == "1"
    if supplied_image and rebuild:
        raise ValueError("SELENIUM_REBUILD cannot rebuild an external SELENIUM_IMAGE")
    if supplied_image:
        releases = {b: {"version": v} for b, v in installed.items()}
        if profile == "minimum" and installed != MINIMUM:
            raise ValueError(f"Minimum image must contain {MINIMUM}; got {installed}")
        if profile == "custom":
            requested = {b: os.environ.get(b.upper() + "_VERSION", "latest") for b in MINIMUM}
            expected = {b: resolve(b, v, platform)["version"] for b, v in requested.items()}
            if installed != expected:
                raise ValueError(f"Custom image versions {installed} do not match requested {expected}")
    else:
        if profile == "minimum":
            requested = MINIMUM
        elif profile == "latest":
            requested = installed if installed and not rebuild else {b: stable[b]["version"] for b in MINIMUM}
        else:
            requested = {b: os.environ.get(b.upper() + "_VERSION", "latest") for b in MINIMUM}
        if profile == "latest":
            check_stable_majors(requested, stable)
        releases = {b: resolve(b, v, platform) for b, v in requested.items()}
        if profile == "custom":
            image = f"copy-as-markdown-selenium-env:ff-{releases['firefox']['version']}-cft-{releases['cft']['version']}-{platform.split('/')[1]}"
    versions = {b: r["version"] for b, r in releases.items()}
    if profile == "latest":
        check_stable_majors(versions, stable)
    metadata = {"profile": profile, "platform": platform, "image": image,
                "browsers": releases, "stable": stable}
    (results / "metadata.json").write_text(json.dumps(metadata, indent=2))
    identity = f"Firefox {versions['firefox']} + Chrome for Testing {versions['cft']}"
    print(f"[Environment] {profile}: {identity}; tests: {selector}", flush=True)
    if not supplied_image:
        args = ["docker", "build", "--platform", platform, "--target", "environment",
                "--build-arg", f"FIREFOX_VERSION={versions['firefox']}",
                "--build-arg", f"CFT_VERSION={versions['cft']}",
                "--build-arg", f"CFT_CHROME_URL={releases['cft']['chrome_url']}",
                "--build-arg", f"CFT_DRIVER_URL={releases['cft']['chromedriver_url']}",
                "-t", image, "-f", str(SCRIPTS / "Dockerfile"), str(ROOT)]
        run(args, results / "build.log")
    runner = f"copy-as-markdown-selenium-runner:{profile}-{selector}-{platform.split('/')[1]}"
    run(["docker", "build", "--platform", platform, "--build-arg", f"SELENIUM_BASE_IMAGE={image}",
         "-t", runner, "-f", str(SCRIPTS / "Runner.Dockerfile"), str(ROOT)], results / "build.log")
    info = capture(["docker", "image", "inspect", "--format",
                    "Image: {{.Id}}; architecture: {{.Architecture}}; digests: {{json .RepoDigests}}", image])
    (results / "environment.log").write_text(identity + "\n" + info + "\n")
    print(info, flush=True)
    run(["docker", "run", "--rm", "--init", "--platform", platform, "--ipc=host", "-e", "CI=true",
         "-e", f"SELENIUM_BROWSER={selector}", "-v", f"{results}:/workspace/test-results",
         runner, *sys.argv[1:]], results / "run.log", stream=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
    except subprocess.CalledProcessError as error:
        if error.returncode == 5:
            print("No tests matched the selected browsers/filter.", file=sys.stderr)
        sys.exit(error.returncode if error.returncode > 0 else 128 - error.returncode)
    except (ValueError, KeyError, OSError) as error:
        sys.exit(f"Selenium setup failed: {error}")

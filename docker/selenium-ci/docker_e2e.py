"""Build/reuse a two-browser environment and run the current checkout once."""
import json
import os
from pathlib import Path
import subprocess
import signal
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
    for browser, release in stable.items():
        version = installed[browser]
        current = release["version"]
        if version.split(".")[0] != current.split(".")[0]:
            raise ValueError(f"{browser}: image {version}, current Stable {current}; major mismatch. "
                             "Rebuild with npm run test:e2e:selenium:build-image.")


def resolve(browser, requested, platform):
    if browser == "cft":
        platform = {"linux/amd64": "linux64", "linux/arm64": "linux-arm64",
                    "linux/arm64/v8": "linux-arm64"}[platform]
    return json.loads(capture([sys.executable, str(SCRIPTS / f"resolve_{browser}.py"),
                               requested, platform]))


def main(build_only=False):
    selector = os.environ.get("BROWSER", "all")
    if selector not in ("all", "firefox", "cft"):
        raise ValueError(f"Unsupported Selenium browser: {selector}")
    overrides = build_only and any(name in os.environ for name in ("FIREFOX_VERSION", "CFT_VERSION"))
    profile = os.environ.get("PROFILE", "custom" if overrides else "latest")
    if profile not in ("minimum", "latest", "custom"):
        raise ValueError(f"Unsupported Selenium profile: {profile}")
    if profile == "custom" and not build_only:
        raise ValueError("Custom versions belong to npm run test:e2e:selenium:build-image")
    if overrides and profile != "custom":
        raise ValueError("Version overrides require PROFILE=custom (or omit the profile)")
    if not build_only and any(name in os.environ for name in
                             ("FIREFOX_VERSION", "CFT_VERSION", "SELENIUM_IMAGE", "SELENIUM_REBUILD",
                              "SELENIUM_PROFILE", "SELENIUM_BROWSER")):
        raise ValueError("Use PROFILE/BROWSER for tests; version overrides belong to the image build command")
    results = ROOT / (f"test-results/selenium-image-{profile}" if build_only else
                      f"test-results/selenium-{profile}-{selector}")
    results.mkdir(parents=True, exist_ok=True)
    results.chmod(0o1777)
    for name in ("junit.xml", "browser.log", "run.log", "build.log", "metadata.json", "environment.log"):
        (results / name).unlink(missing_ok=True)
    platform = os.environ.get("DOCKER_DEFAULT_PLATFORM") or "linux/" + capture(
        ["docker", "version", "--format", "{{.Server.Arch}}"])
    if platform not in ("linux/amd64", "linux/arm64", "linux/arm64/v8"):
        raise ValueError(f"Unsupported Docker platform: {platform}")
    image = f"copy-as-markdown-selenium-env:{profile}-{platform.split('/')[1]}"
    installed = image_versions(image) if profile != "custom" else None
    stable = {}
    stable_check = {"status": "not_applicable"}
    if profile == "latest":
        stable_check = {"status": "verified", "browsers": {}}
        for browser in MINIMUM:
            try:
                release = resolve(browser, "latest", platform)
            except (subprocess.CalledProcessError, ValueError, KeyError, OSError) as error:
                if build_only or not installed or os.environ.get("CI", "").lower() in ("true", "1"):
                    raise ValueError(f"Cannot verify {browser} Stable metadata; stopping "
                                     "(offline fallback requires an existing image and local mode)") from error
                stable_check["status"] = "unverified"
                stable_check["browsers"][browser] = {"status": "unverified", "reason": str(error)}
                print(f"[Warning] {browser} Stable major unverified; using the existing local image.",
                      file=sys.stderr)
                continue
            stable[browser] = release
            stable_check["browsers"][browser] = {"status": "verified"}
            if installed and not build_only:
                check_stable_majors(installed, {browser: release})
    needs_build = build_only or not installed
    if not needs_build:
        releases = {b: {"version": v} for b, v in installed.items()}
        if profile == "minimum" and installed != MINIMUM:
            raise ValueError(f"Minimum image must contain {MINIMUM}; got {installed}")
    else:
        if profile == "minimum":
            requested = MINIMUM
        elif profile == "latest":
            requested = {b: stable[b]["version"] for b in MINIMUM}
        else:
            requested = {b: os.environ.get(b.upper() + "_VERSION", "latest") for b in MINIMUM}
        releases = {b: resolve(b, v, platform) for b, v in requested.items()}
        if profile == "custom":
            image = f"copy-as-markdown-selenium-env:ff-{releases['firefox']['version']}-cft-{releases['cft']['version']}-{platform.split('/')[1]}"
    versions = {b: r["version"] for b, r in releases.items()}
    if stable:
        check_stable_majors(versions, stable)
    metadata = {"profile": profile, "platform": platform, "image": image,
                "browsers": releases, "stable": stable, "stable_check": stable_check}
    (results / "metadata.json").write_text(json.dumps(metadata, indent=2))
    identity = f"Firefox {versions['firefox']} + Chrome for Testing {versions['cft']}"
    print(f"[Environment] {profile}: {identity}; tests: {selector}", flush=True)
    if needs_build:
        args = ["docker", "build", "--platform", platform, "--target", "environment",
                "--build-arg", f"FIREFOX_VERSION={versions['firefox']}",
                "--build-arg", f"CFT_VERSION={versions['cft']}",
                "--build-arg", f"CFT_CHROME_URL={releases['cft']['chrome_url']}",
                "--build-arg", f"CFT_DRIVER_URL={releases['cft']['chromedriver_url']}",
                "-t", image, "-f", str(SCRIPTS / "Dockerfile"), str(ROOT)]
        run(args, results / "build.log")
    if build_only:
        print(f"[Image ready] {image}", flush=True)
        return
    runner = f"copy-as-markdown-selenium-runner:{profile}-{selector}-{platform.split('/')[1]}"
    run(["docker", "build", "--platform", platform, "--build-arg", f"SELENIUM_BASE_IMAGE={image}",
         "-t", runner, "-f", str(SCRIPTS / "Runner.Dockerfile"), str(ROOT)], results / "build.log")
    info = capture(["docker", "image", "inspect", "--format",
                    "Image: {{.Id}}; architecture: {{.Architecture}}; digests: {{json .RepoDigests}}", image])
    (results / "environment.log").write_text(identity + "\n" + info + "\n")
    print(info, flush=True)
    run(["docker", "run", "--rm", "--init", "--platform", platform, "--ipc=host", "-e", "CI=true",
         "-e", f"BROWSER={selector}", "-v", f"{results}:/workspace/test-results",
         runner, *sys.argv[1:]], results / "run.log", stream=True)


if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(128 + signum))
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

"""Reuse one Stable/ESR browser environment and run the current checkout once."""
import json
import os
from pathlib import Path
import subprocess
import signal
import sys

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "docker/selenium-ci"
BROWSERS = ("firefox", "cft")
IMAGE_BROWSERS = ("firefox", "firefox_esr", "cft")


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
    return {b: env[b.upper() + "_VERSION"] for b in IMAGE_BROWSERS if env.get(b.upper() + "_VERSION")}


def check_stable_majors(installed, stable):
    for browser, release in stable.items():
        version = installed[browser]
        current = release["version"]
        if version.split(".")[0] != current.split(".")[0]:
            raise ValueError(f"{browser}: image {version}, current channel {current}; major mismatch. "
                             "Rebuild with npm run test:e2e:selenium:build-image.")


def resolve(browser, requested):
    if browser == "firefox_esr":
        browser, requested = "firefox", "esr"
    return json.loads(capture([sys.executable, str(SCRIPTS / f"resolve_{browser}.py"),
                               requested]))


def main(build_only=False):
    overrides = build_only and any(name in os.environ for name in ("FIREFOX_VERSION", "CFT_VERSION"))
    profile = os.environ.get("PROFILE", "custom" if overrides else "latest")
    if profile not in ("esr", "latest", "custom"):
        raise ValueError(f"Unsupported Selenium profile: {profile}")
    selector = os.environ.get("BROWSER", "firefox" if profile == "esr" else "all")
    if selector not in ("all", "firefox", "cft"):
        raise ValueError(f"Unsupported Selenium browser: {selector}")
    if profile == "esr":
        if selector == "cft":
            raise ValueError("PROFILE=esr tests Firefox ESR only; BROWSER=cft is unavailable")
        selector = "firefox"
    if profile == "custom" and not build_only:
        raise ValueError("Custom versions belong to npm run test:e2e:selenium:build-image")
    if overrides and profile != "custom":
        raise ValueError("Version overrides require PROFILE=custom (or omit the profile)")
    if not build_only and any(name in os.environ for name in ("FIREFOX_VERSION", "CFT_VERSION")):
        raise ValueError("Use PROFILE/BROWSER for tests; version overrides belong to the image build command")
    results = ROOT / (f"test-results/selenium-image-{profile}" if build_only else
                      f"test-results/selenium-{profile}-{selector}")
    results.mkdir(parents=True, exist_ok=True)
    results.chmod(0o1777)
    for name in ("junit.xml", "browser.log", "run.log", "build.log", "metadata.json", "environment.log"):
        (results / name).unlink(missing_ok=True)
    image = "copy-as-markdown-selenium-env:latest"
    installed = image_versions(image) if profile != "custom" else None
    # Older split images lack ESR; replace them through the normal build path.
    if installed and set(installed) != set(IMAGE_BROWSERS):
        installed = None
    browsers = ("firefox_esr",) if profile == "esr" else BROWSERS
    if installed and not installed["firefox_esr"].endswith("esr"):
        raise ValueError("ESR image must contain an ESR release; rebuild its environment")
    stable = {}
    stable_check = {"status": "not_applicable"}
    if profile in ("latest", "esr"):
        stable_check = {"status": "verified", "browsers": {}}
        for browser in IMAGE_BROWSERS if build_only or not installed else browsers:
            try:
                release = resolve(browser, "latest")
            except (subprocess.CalledProcessError, ValueError, KeyError, OSError) as error:
                if build_only or not installed or os.environ.get("CI", "").lower() in ("true", "1"):
                    raise ValueError(f"Cannot verify {browser} {profile} channel metadata; stopping "
                                     "(offline fallback requires an existing image and local mode)") from error
                stable_check["status"] = "unverified"
                stable_check["browsers"][browser] = {"status": "unverified", "reason": str(error)}
                print(f"[Warning] {browser} {profile} channel major unverified; using the existing local image.",
                      file=sys.stderr)
                continue
            stable[browser] = release
            stable_check["browsers"][browser] = {"status": "verified"}
            if installed and not build_only:
                check_stable_majors(installed, {browser: release})
    needs_build = build_only or not installed
    if not needs_build:
        releases = {b: {"version": v} for b, v in installed.items()}
    elif profile == "custom":
        releases = {b: resolve(b, os.environ.get(b.upper() + "_VERSION", "latest")) for b in IMAGE_BROWSERS}
        image = (f"copy-as-markdown-selenium-env:ff-{releases['firefox']['version']}"
                 f"-esr-{releases['firefox_esr']['version']}-cft-{releases['cft']['version']}")
    else:
        releases = stable
    versions = {b: r["version"] for b, r in releases.items()}
    metadata = {"profile": profile, "image": image,
                "browsers": releases, "stable": stable, "stable_check": stable_check}
    (results / "metadata.json").write_text(json.dumps(metadata, indent=2))
    identity = (f"Firefox {versions['firefox']} + Firefox ESR {versions['firefox_esr']}"
                f" + Chrome for Testing {versions['cft']}")
    print(f"[Environment] {profile}: {identity}; tests: {selector}", flush=True)
    if needs_build:
        args = ["docker", "build", "--target", "environment"]
        for browser, version in versions.items():
            args.extend(["--build-arg", f"{browser.upper()}_VERSION={version}"])
        args.extend(["-t", image, "-f", str(SCRIPTS / "Dockerfile"), str(ROOT)])
        run(args, results / "build.log")
    if build_only:
        print(f"[Image ready] {image}", flush=True)
        return
    runner = f"copy-as-markdown-selenium-runner:{profile}-{selector}"
    run(["docker", "build", "--build-arg", f"SELENIUM_BASE_IMAGE={image}",
         "-t", runner, "-f", str(SCRIPTS / "Runner.Dockerfile"), str(ROOT)], results / "build.log")
    info = capture(["docker", "image", "inspect", "--format",
                    "Image: {{.Id}}; architecture: {{.Architecture}}; digests: {{json .RepoDigests}}", image])
    (results / "environment.log").write_text(identity + "\n" + info + "\n")
    print(info, flush=True)
    run(["docker", "run", "--rm", "--init", "--ipc=host", "-e", "CI=true",
         "-e", f"PROFILE={profile}",
         "-e", f"BROWSER={selector}", "-v", f"{results}:/workspace/test-results:Z",
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

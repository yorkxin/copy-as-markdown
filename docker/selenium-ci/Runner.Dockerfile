ARG SELENIUM_BASE_IMAGE
FROM ${SELENIUM_BASE_IMAGE}
# Keep the current checkout separate from the reusable browser environment.
COPY --chown=appuser:appuser . /workspace
# A cached environment may carry an older entrypoint; run the checkout's script.
COPY --chmod=755 docker/selenium-ci/run-selenium.sh /usr/local/bin/run-selenium.sh

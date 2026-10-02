ARG SELENIUM_BASE_IMAGE
FROM ${SELENIUM_BASE_IMAGE}
# Keep the current checkout separate from the reusable browser environment.
COPY --chown=appuser:appuser . /workspace

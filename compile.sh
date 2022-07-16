#!/usr/bin/env bash

# NOTE: `cp -R src/ dist/` has different behaviors in GNU cp (Linux) and macOS cp
cp -a src/* firefox-mv2/dist/
cp -a src/ firefox/dist/
cp -a src/* chrome/dist/

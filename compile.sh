#!/usr/bin/env bash

folder=$1

# NOTE: `cp -R src/ dist/` has different behaviors in GNU cp (Linux) and macOS cp
cp -a src/* "$folder/dist/"

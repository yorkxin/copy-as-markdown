#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

const destination = process.argv[2];

fs.cpSync(path.join(import.meta.dirname, '..', 'dist/'), `${destination}/dist/`, { recursive: true });
fs.cpSync(path.join(import.meta.dirname, '..', 'src/vendor'), `${destination}/dist/vendor`, { recursive: true });
fs.cpSync(path.join(import.meta.dirname, '..', 'src/static'), `${destination}/dist/static`, { recursive: true });

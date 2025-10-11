#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

const folder = process.argv[2];

fs.cpSync(path.join(import.meta.dirname, '..', 'src/'), `${folder}/dist/`, { recursive: true });

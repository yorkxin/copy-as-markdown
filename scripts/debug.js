#!/usr/bin/env node

import nodemon from 'nodemon';

import * as process from 'node:process';
import child_process from 'node:child_process';
import * as path from 'node:path';

const browser = process.argv[2];

const root = path.join(import.meta.dirname, '..');

const app = nodemon({
  script: path.join(root, 'scripts/compile.js'),
  args: [browser === 'edge' ? 'chrome' : browser],
  watch: [path.join(root, 'src')],
  ext: '*',
  spawn: true,
});

/** @type {child_process.ChildProcess} */
let spawnedBrowser;

const edgeBinary = {
  darwin: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  win32: '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"',
};

switch (browser) {
  case 'chrome':
    console.log('starting chrome');

    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --args chrome://extensions https://example.com`);
    break;
  case 'edge': {
    console.log('starting edge');
    const binary = edgeBinary[process.platform];
    if (typeof binary === 'undefined') {
      throw new TypeError(`unsupported Edge platform: ${process.platform}`);
    }

    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --chromium-binary "${binary}" --args chrome://extensions https://example.com`);
    break;
  }
  case 'firefox':
    console.log('starting firefox');

    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'firefox')} --url about:debugging#/runtime/this-firefox https://example.com`);
    break;
  case 'firefox-deved':
    console.log('starting firefox developer edition');

    spawnedBrowser = child_process.exec(`npx web-ext run -f deved -s ${path.join(root, 'firefox')} --url about:debugging#/runtime/this-firefox https://example.com`);
    break;
  case 'firefox-mv3':
    console.log('starting firefox-mv3');

    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'firefox-mv3')} --url about:debugging#/runtime/this-firefox https://example.com`);
    break;
  default:
    throw new Error(`unsupported browser ${browser}`);
}

spawnedBrowser.on('exit', () => {
  console.log('browser exited');
  process.exit(0);
});

app.on('message', (event) => {
  if (event === 'crash') {
    spawnedBrowser.kill(9);
  }
});

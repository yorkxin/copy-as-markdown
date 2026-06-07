#!/usr/bin/env node
import * as process from 'node:process';
import child_process from 'node:child_process';
import * as path from 'node:path';

const browser = process.argv[2];
const root = path.join(import.meta.dirname, '..');

/** Start `scripts/build.js <target> --watch` as a child process. */
function startWatch(target) {
  return child_process.spawn(
    'node',
    [path.join(root, 'scripts/build.js'), target, '--watch'],
    { stdio: 'inherit' },
  );
}

/** @type {child_process.ChildProcess} */
let builder;
/** @type {child_process.ChildProcess} */
let spawnedBrowser;

const edgeBinary = {
  darwin: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  win32: '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"',
};

switch (browser) {
  case 'chrome':
    console.log('starting chrome');
    builder = startWatch('chrome');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --args chrome://extensions https://example.com`);
    break;
  case 'edge': {
    console.log('starting edge');
    const binary = edgeBinary[process.platform];
    if (typeof binary === 'undefined') {
      throw new TypeError(`unsupported Edge platform: ${process.platform}`);
    }
    builder = startWatch('chrome');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'chrome')} -t chromium --chromium-binary "${binary}" --args chrome://extensions https://example.com`);
    break;
  }
  case 'firefox-mv3':
    console.log('starting firefox-mv3');
    builder = startWatch('firefox-mv3');
    spawnedBrowser = child_process.exec(`npx web-ext run -s ${path.join(root, 'firefox-mv3')} --url about:debugging#/runtime/this-firefox https://example.com`);
    break;
  default:
    throw new Error(`unsupported browser ${browser}`);
}

spawnedBrowser.on('exit', () => {
  console.log('browser exited');
  if (builder) builder.kill();
  process.exit(0);
});

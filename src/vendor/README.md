# Vendor Directory

This directory contains third-party library files that are copied to the extension during the build process.

## Files

- **mustache.mjs** - ⚠️ This file is now **automatically copied** from `node_modules/mustache/` during the build process via `scripts/copy-deps.js`. You can delete this file from version control if desired.

- **browser-polyfill.js** - WebExtension polyfill for cross-browser compatibility (manually vendored)

- **bulma.css** - CSS framework for UI styling (manually vendored)

- **turndown.js** - HTML to Markdown converter (manually vendored)

## Managing Dependencies

### Automatic (Recommended)

For dependencies that are available in npm, add them to `scripts/copy-deps.js`:

```javascript
{
  name: 'package-name',
  files: [
    { from: 'path/in/package.js', to: 'output-name.js' },
  ],
}
```

The files will be automatically copied from `node_modules/` to `dist/vendor/` during `npm run build:ts`.

### Manual Vendoring

For files not available in npm or requiring customization, manually place them in this directory. They will be copied to the extension during the build process.

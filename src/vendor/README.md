# Vendor Directory

This directory contains third-party library files that are copied to the extension during the build process.

## Files

All files in this directory are automatically copied from `node_modules/` during `npm install` via `scripts/postinstall.js`:

- **mustache.mjs** - Mustache templating library
- **browser-polyfill.js** - WebExtension polyfill for cross-browser compatibility
- **bulma.css** - CSS framework for UI styling
- **turndown.js** - HTML to Markdown converter

These files are then copied to `dist/vendor/` in the final extension packages during the build process.

## Managing Dependencies

### Adding New Dependencies

To add a new vendored dependency, add it to the `files` array in `scripts/postinstall.js`:

```javascript
const files = [
  'node_modules/package-name/dist/file.js',
  // ... other files
];
```

The file will be automatically copied to this directory during `npm install` and will be available for:

- IDE type checking and autocomplete
- TypeScript compilation
- Runtime usage in the extension

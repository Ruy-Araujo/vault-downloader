# Vault Downloader

Vault Downloader is a Manifest V3 Chrome extension that exports an authorized 3D model page into one offline ZIP file. It recognizes Creality Cloud, MakerWorld, and Printables and uses the same archive layout for every source.

The ZIP contains a folder named after the model, platform files, author profiles when available, `metadata.txt`, `description.txt`, `description.html`, gallery PNGs, and local description images. Individual failures are retained in a partial ZIP and shown in the popup.

## Install

Use Node.js 20 or newer:

```bash
npm install
npm test
npm run package
```

Extract `dist/vault-downloader.zip`, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** on the extracted folder.

## Use

Sign in when required, open a model page, and click the Vault Downloader icon. The extension recognizes the source, collects official URLs using the page session, downloads files in the offscreen document, and creates the ZIP. The popup reports progress and individual errors. Retry can reuse temporary files until navigation, cancellation, or a completed export clears them.

Supported URL families are Creality Cloud model details, MakerWorld `/models/<id>` pages, and Printables `/model/<id>` pages. Protected files and account-restricted files remain unavailable. The extension never reads passwords, directly reads cookies, or stores tokens.

## Architecture

`sources.js` is the source registry and URL recognizer. `page-collector.js` contains the Creality adapter, while `source-collectors.js` contains the independent MakerWorld and Printables adapters. Every adapter returns a serializable export plan; the shared background/offscreen pipeline handles caching, retries, image conversion, metadata, ZIP creation, progress, and cancellation.

To add a source, implement a detector and collector returning `source`, `item`, and a normalized `files` array, register its hosts and scripts in `sources.js`, update `manifest.json` and packaging, and add fixture tests for recognition and authorization failures.

## Permissions and limits

The extension requests active-tab scripting, downloads, offscreen storage, and only the source/API/CDN hosts needed by the adapters. It performs sequential downloads, creates a ZIP32 archive without ZIP64, and does not resume after Chrome closes. Each platform's account, licensing, rate-limit, and authorization rules still apply.

This project is a local fork of [Ruy-Araujo/creality_downloader](https://github.com/Ruy-Araujo/creality_downloader); the original repository is configured as the `upstream` remote.

# pbrtopia

Makes **PBR materials** (colour, normal, height, roughness, metal and more) from a text prompt or reference images, lets you edit and paint them, and exports them ready for your 3D tools.

> **This repository is a read-only mirror.** It is generated from a central repository on every change and overwritten each time, so commits made here are lost. Contributions are taken at the central repository once it opens.

## Use it

- **Web:** www.pbrtopia.com
- **From source:** `npm install`, `npm run build:mat`, then run `scripts/offline/start-pbrtopia.bat` (Windows). It serves the build on `http://127.0.0.1:4393` and opens it. For development use `npm run dev:mat`.
- **Desktop app:** `npm run desktop:build:mat` (needs the Rust toolchain), or run the exe release.

## Keys and privacy

Generating needs an API key from Google (Gemini) or OpenAI, entered in Settings or read from the environment. There is no account and no server of ours: projects, images and keys stay on your device. Only what you send with Generate goes to the provider you chose. Keys read from the environment are never stored.

## Checks

`npm run typecheck`, `npm test`, `npm run check:split`.

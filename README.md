PBRTopia generates **PBR materials** (colour, normal, height, roughness, metal and more) from text prompts or reference images, lets you edit and paint them, and exports them ready for your 3D tools.

It's main distinguishing feature is decomposing surfaces into individual materials, like metal paint, rust, etc. 

> **This repository is a read-only mirror.** It is generated from a central repository on every change and overwritten each time, so commits made here are lost. Contributions are taken at the central repository once it opens. Still, it is full feature source that you can clone to build the app.

## How to use the app
1. Get a Gemini or OpenAI api key
2. Setup the client: 
- **Lowest setup:** the website www.pbrtopia.com 
- **Safest setup:** build it from source - clone this repo, `npm install`, `npm run build:mat`, then run `scripts/offline/start-pbrtopia.bat` (Windows). It serves the build on `http://127.0.0.1:4393` and opens it. For development use `npm run dev:mat`.
- **Low setup and safety:** the desktop app can be run directly as follows `npm run desktop:build:mat` (needs the Rust toolchain), or run the exe release https://github.com/mohbenaicha/pbrtopia/releases. This allows your app to read environment variables instead of having to enter them into the app.

## Keys and privacy

- Generating needs an API keys entered in Settings or read from the environment - and although keys are encrypted when stored and never sent anywhere except for your chosed provider, the latter is recommended. 
- The app doesnt send anything to a remote server of ours, projects, images and keys are stored on your device. Only what you send with Generate goes to the provider you chose. 
- Keys read from the environment are never stored.

## Checks

`npm run typecheck`, `npm test`, `npm run check:split`.

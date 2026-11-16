The welcome shown once on the first launch (specs/materialgen/tutorial R14). Same format as tutorial-text.md: `## id | Heading`, then paragraphs; **bold** and *italic* only.
The GitHub address is in welcomeLinks.ts (the agent instructions and the corner icon use it too).

## title | Welcome to pbrtopia

## what | What it does
PBRTopia makes **PBR materials** (colour, normal, height, roughness, metal and more) from a text prompt or reference images, lets you edit and paint them, and exports them ready for your 3D tools.

## needs | What you need
An **API key** from Google (*Gemini*) or *OpenAI*. Enter it in **Settings**, or from your  environment variable if you use executable build or local web build. Without a key you you can only load textures you have to edit.

## where | Where to use it
Use the web app at **www.pbrtopia.com**, or **build it from GitHub** from source (recommended for transparency) or run the **exe release**. If you work with a coding agent, copy the setup instructions and paste them to it.

## privacy | Your data stays with you
There is no account and no server of ours: your projects, images and keys stay on this device and are **never uploaded** to us. Only what you send with **Generate** goes to the provider you chose over https. Keys read from the environment are **never stored**.

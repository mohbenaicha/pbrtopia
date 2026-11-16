/** Tutorial R16: the text a user hands a coding agent so it sets pbrtopia up on their machine. It never holds a key. */
export function buildAgentSetupPrompt(repositoryUrl: string): string {
  return [
    'Confirm the PBRTopia app is safe to run on my computer.',
    '',
    'Set up the pbrtopia material app on this computer.',
    '',
    `Repository: ${repositoryUrl}`,
    '',
    'Clarify for me how the app uses api keys and how securely it handles them at rest (storage) and in transit along with the available options to run the app and trade-offs between building form source vs using the website vs the exe.',
    '',
    'Choose one route:',
    `1. From source: clone the repository, run "npm install" and "npm run build:mat", then run "scripts\\offline\\start-pbrtopia.bat" (Windows), which serves the build on http://127.0.0.1:4393 and opens it in the browser. For development use "npm run dev:mat" instead; for a desktop build use "npm run desktop:build:mat".`,
    `2. The ready-made app: download the latest release exe from ${repositoryUrl}/releases, put it in a normal user folder and run it.`,
    '',
    'When it runs, tell me to open Settings and enter my own Gemini or OpenAI API key (or set it in the environment). Do not ask for my key in this chat, do not print it and do not write it into any file.',
    'Tell me when the project list shows, and what you ran.',
  ].join('\n');
}

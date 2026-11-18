/** Tutorial R14: where the welcome, the agent instructions and the corner GitHub icon send people. */
export const WEB_APP_URL = 'https://www.pbrtopia.com';

/** The read-only mirror repository (specs/app/mirror); its Releases page carries the exe. */
export const GITHUB_URL = 'https://github.com/mohbenaicha/pbrtopia';

/** The mirror's Releases page, where the exe is downloaded (tutorial R20). */
export const RELEASES_URL = `${GITHUB_URL}/releases`;

/** The keys a welcome words file may link to with `[text](key)` (tutorial R20). */
export const WELCOME_LINKS: Readonly<Record<string, string>> = { web: WEB_APP_URL, github: GITHUB_URL, releases: RELEASES_URL };

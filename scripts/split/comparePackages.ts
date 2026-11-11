// Materialgen app R49: the packages the material app imports must be declared here, at the versions upstream declares.
export interface PackageManifest {
  dependencies?: Record<string, string> | undefined;
  devDependencies?: Record<string, string> | undefined;
}

const versionOf = (manifest: PackageManifest, name: string): string | undefined => manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];

/** One line per missing or mismatched package: missing ones first (sorted), then version mismatches (in list order). */
export function comparePackages(used: readonly string[], own: PackageManifest, upstream: PackageManifest): string[] {
  const missing: string[] = [];
  const mismatched: string[] = [];
  for (const name of [...used].sort()) {
    const ownVersion = versionOf(own, name);
    const upstreamVersion = versionOf(upstream, name);
    if (ownVersion === undefined) missing.push(`missing: ${name} is imported but not declared in package.json`);
    else if (upstreamVersion === undefined) missing.push(`missing: ${name} is not declared in the upstream package.json`);
    else if (ownVersion !== upstreamVersion) mismatched.push(`mismatch: ${name} is ${ownVersion} here but ${upstreamVersion} upstream`);
  }
  return [...missing.sort(), ...mismatched];
}

import { MAX_COMPONENTS, MIN_COMPONENTS, type Component } from '../describe/parseComponents';

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Masks R8a: the masks field while the describe step is done and the picture is not: only the components and the albedo they were made from. */
export function serializeDescribedComponents(albedoKey: string, components: ReadonlyArray<Component>): Raw {
  return { source: 'model', described: { albedoKey, components: components.map(({ name, description, location }) => ({ name, description, location })) } };
}

/** Masks R8b: the saved components when they were made from this albedo and are a valid list (3 to 10, with text fields); otherwise null. */
export function parseDescribedComponents(raw: unknown, albedoKey: string): Component[] | null {
  if (!isObject(raw) || !isObject(raw['described']) || raw['described']['albedoKey'] !== albedoKey) return null;
  const list = raw['described']['components'];
  if (!Array.isArray(list) || list.length < MIN_COMPONENTS || list.length > MAX_COMPONENTS) return null;
  const components: Component[] = [];
  for (const entry of list) {
    if (!isObject(entry) || typeof entry['name'] !== 'string' || typeof entry['description'] !== 'string' || typeof entry['location'] !== 'string') return null;
    components.push({ name: entry['name'], description: entry['description'], location: entry['location'] });
  }
  return components;
}

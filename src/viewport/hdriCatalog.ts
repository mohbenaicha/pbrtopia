export interface HdriChoice {
  id: string; // the file name under public/hdri/ without .hdr; 'studio' is the built-in environment and has no file
  label: string;
}

// Order is the order of the list in the settings panel.
export const HDRI_CHOICES: readonly HdriChoice[] = [
  { id: 'studio', label: 'Studio (built-in)' },
  { id: 'studio_small_09', label: 'Photo studio' },
  { id: 'kloofendal_48d_partly_cloudy_puresky', label: 'Partly cloudy sky' },
  { id: 'overcast_soil_puresky', label: 'Overcast sky' },
  { id: 'venice_sunset', label: 'Venice sunset' },
  { id: 'moonless_golf', label: 'Moonless night' },
];

// Only ids from the catalog map to a file, so a stored or typed id can never turn into an arbitrary fetch.
export function hdriUrl(id: string): string | undefined {
  if (id === 'studio' || !HDRI_CHOICES.some((choice) => choice.id === id)) return undefined;
  return `${import.meta.env.BASE_URL}hdri/${id}.hdr`;
}

import { FieldProblem, isRawRecord, readBlobKey, readChoice, readCount, readList, readNonEmptyText, readObject, readText, readTimestamp } from './fieldReaders';

export type PictureChannel = 'albedo' | 'normal' | 'rough' | 'metal';
const CHANNELS = ['albedo', 'normal', 'rough', 'metal'] as const;

// A generated picture, stored once as a PNG file (specs/app/textures/data-model.md).
export interface PictureRecord {
  id: string; // unique in the project
  channel: PictureChannel;
  blobKey: string; // pictures/<id>.png
  width: number;
  height: number;
  createdAt: string; // ISO time
  origin: { kind: 'bake'; setId: string }; // informational: the set may be deleted later
}

// One map of one material showing a generated picture instead of the model file's own map. No record means the slot shows the file's picture.
export interface SlotRecord {
  materialIndex: number; // position in the material list captured when the model was loaded
  materialName: string;
  channel: PictureChannel;
  pictureId: string;
}

export const pictureBlobKey = (pictureId: string): string => `pictures/${pictureId}.png`;

function readPicture(value: unknown, path: string): PictureRecord {
  const raw = readObject(value, path);
  const origin = readObject(raw['origin'], `${path}.origin`);
  return {
    id: readNonEmptyText(raw['id'], `${path}.id`),
    channel: readChoice(raw['channel'], `${path}.channel`, CHANNELS),
    blobKey: readBlobKey(raw['blobKey'], `${path}.blobKey`),
    width: readCount(raw['width'], `${path}.width`, 1),
    height: readCount(raw['height'], `${path}.height`, 1),
    createdAt: readTimestamp(raw['createdAt'], `${path}.createdAt`),
    origin: { kind: readChoice(origin['kind'], `${path}.origin.kind`, ['bake'] as const), setId: readNonEmptyText(origin['setId'], `${path}.origin.setId`) },
  };
}

/** Strict: a bad field, a missing list or two pictures with one id is a FieldProblem (the project is corrupt). */
export function readPictures(value: unknown, path: string): PictureRecord[] {
  const pictures = readList(value, path, readPicture);
  const seen = new Set<string>();
  pictures.forEach((picture, index) => {
    if (seen.has(picture.id)) throw new FieldProblem(`${path}[${index}].id`);
    seen.add(picture.id);
  });
  return pictures;
}

function readSlot(value: unknown): SlotRecord {
  const raw = readObject(value, 'slot');
  return {
    materialIndex: readCount(raw['materialIndex'], 'slot.materialIndex'),
    materialName: readText(raw['materialName'], 'slot.materialName'),
    channel: readChoice(raw['channel'], 'slot.channel', CHANNELS),
    pictureId: readNonEmptyText(raw['pictureId'], 'slot.pictureId'),
  };
}

/**
 * Lenient: a slot with a bad field, an unknown picture, a channel that differs from its picture's or a slot already listed is ignored
 * (the first one wins), and anything that is not a list reads as no slots. The check against the model's materials is the app's.
 */
export function readSlots(value: unknown, pictures: readonly PictureRecord[]): SlotRecord[] {
  if (!Array.isArray(value)) return [];
  const channelOf = new Map(pictures.map((picture) => [picture.id, picture.channel]));
  const taken = new Set<string>();
  const slots: SlotRecord[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!isRawRecord(value[index])) continue;
    let slot: SlotRecord;
    try {
      slot = readSlot(value[index]);
    } catch (problem) {
      if (problem instanceof FieldProblem) continue;
      throw problem;
    }
    const key = `${slot.materialIndex}:${slot.channel}`;
    if (channelOf.get(slot.pictureId) !== slot.channel || taken.has(key)) continue;
    taken.add(key);
    slots.push(slot);
  }
  return slots;
}

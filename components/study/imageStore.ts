import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Where image-occlusion pictures live: on the device, keyed by id, never in
 * the ledger. The ledger is one JSON document that SyncService pushes whole
 * on every save — a few photos inlined as base64 would make every flashcard
 * answer upload megabytes. Cards hold only `imageId`.
 *
 * The consequence is that pictures do not follow a student to a second
 * device yet; the review card says so instead of showing a broken image.
 * Moving this store to cloud storage later only changes this file.
 *
 * Native keeps JPEG files under the document directory. Web has no file
 * system, so it keeps the data URI in AsyncStorage (localStorage).
 */

/** Longest side after import. Enough to read a textbook diagram on a phone, small enough to store. */
const MAX_SIDE = 1600;
const QUALITY = 0.72;
const DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}occlusion/` : null;
const webKey = (id: string) => `@occlusion_image_${id}`;

export interface StoredImage {
  id: string;
  width: number;
  height: number;
}

const newId = () => `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Downscales, compresses and stores a picked image. Returns its id and final size. */
export async function saveImage(sourceUri: string, srcWidth?: number, srcHeight?: number): Promise<StoredImage> {
  const id = newId();
  const long = Math.max(srcWidth || 0, srcHeight || 0);
  const ctx = ImageManipulator.manipulate(sourceUri);
  if (long > MAX_SIDE) {
    if ((srcWidth || 0) >= (srcHeight || 0)) ctx.resize({ width: MAX_SIDE });
    else ctx.resize({ height: MAX_SIDE });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: Platform.OS === 'web' });

  if (Platform.OS === 'web' || !DIR) {
    const uri = out.base64 ? `data:image/jpeg;base64,${out.base64}` : out.uri;
    await AsyncStorage.setItem(webKey(id), uri);
  } else {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true }).catch(() => {});
    await FileSystem.copyAsync({ from: out.uri, to: `${DIR}${id}.jpg` });
  }
  return { id, width: out.width, height: out.height };
}

const cache = new Map<string, string | null>();

/** A displayable uri for a stored image, or null when it is not on this device. */
export async function getImageUri(id: string): Promise<string | null> {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id)!;
  let uri: string | null = null;
  try {
    if (Platform.OS === 'web' || !DIR) {
      uri = await AsyncStorage.getItem(webKey(id));
    } else {
      const path = `${DIR}${id}.jpg`;
      const info = await FileSystem.getInfoAsync(path);
      uri = info.exists ? path : null;
    }
  } catch {
    uri = null;
  }
  cache.set(id, uri);
  return uri;
}

/** Removes an image no note uses any more. Missing files are fine. */
export async function deleteImage(id: string): Promise<void> {
  if (!id) return;
  cache.delete(id);
  try {
    if (Platform.OS === 'web' || !DIR) await AsyncStorage.removeItem(webKey(id));
    else await FileSystem.deleteAsync(`${DIR}${id}.jpg`, { idempotent: true });
  } catch {}
}

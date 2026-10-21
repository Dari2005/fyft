import type * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';
import type { PartyMedia } from './types';

/** Supabase Storage bucket for party photos/videos (public read). */
export const MEDIA_BUCKET = 'party-media';

/** Max media items (photos + videos) per party. */
export const MAX_MEDIA_ITEMS = 6;

/**
 * Uploads picked image/video assets to Supabase Storage under the user's
 * folder and returns their public URLs as PartyMedia items.
 * Throws on the first failed upload.
 */
export async function uploadPartyMedia(
  userId: string,
  assets: ImagePicker.ImagePickerAsset[]
): Promise<PartyMedia[]> {
  const uploaded: PartyMedia[] = [];

  for (const asset of assets) {
    const type: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
    const ext = (
      asset.fileName?.split('.').pop() ?? (type === 'video' ? 'mp4' : 'jpg')
    ).toLowerCase();
    const path = `${userId}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;

    const response = await fetch(asset.uri);
    const data = await response.arrayBuffer();

    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, data, {
      contentType: asset.mimeType ?? (type === 'video' ? 'video/mp4' : 'image/jpeg'),
      upsert: false,
    });
    if (error) throw error;

    const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    uploaded.push({ url: pub.publicUrl, type });
  }

  return uploaded;
}

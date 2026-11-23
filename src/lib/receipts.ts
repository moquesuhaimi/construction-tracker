import { supabase } from './supabase';

// Receipt photos live in the private Supabase Storage bucket "receipts",
// under <project_id>/<random>.jpg. The expenses.receipt_image column only
// holds a short pointer to the file ("storage:<path>"), so the database
// stays small.
//
// Older expenses may still hold the full photo as base64 text
// ("data:image/..."). Those keep working, and the admin "Move receipts to
// Storage" tool in Settings converts them.

export const RECEIPTS_BUCKET = 'receipts';
const STORAGE_PREFIX = 'storage:';

export const isStoredReceipt = (value: string | null | undefined): value is string =>
  !!value && value.startsWith(STORAGE_PREFIX);

export const isInlineReceipt = (value: string | null | undefined): value is string =>
  !!value && value.startsWith('data:');

const storagePath = (value: string) => value.slice(STORAGE_PREFIX.length);

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return res.blob();
};

const extensionFor = (mime: string) => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
};

// Upload a base64 data URL to Storage and return the pointer to save in
// expenses.receipt_image.
export const uploadReceiptDataUrl = async (projectId: string, dataUrl: string): Promise<string> => {
  const blob = await dataUrlToBlob(dataUrl);
  const contentType = blob.type || 'image/jpeg';
  const path = `${projectId}/${crypto.randomUUID()}.${extensionFor(contentType)}`;

  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, blob, { contentType, upsert: false });

  if (error) throw error;
  return `${STORAGE_PREFIX}${path}`;
};

// Turn whatever is saved in receipt_image into something an <img> can show.
export const resolveReceiptUrl = async (value: string | null): Promise<string | null> => {
  if (!value) return null;
  if (!isStoredReceipt(value)) return value; // legacy base64 or a plain URL

  const { data, error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .createSignedUrl(storagePath(value), 60 * 60);

  if (error || !data) {
    console.error('Failed to create receipt link', error);
    return null;
  }
  return data.signedUrl;
};

// Remove the stored file behind a pointer (no-op for legacy base64).
export const removeStoredReceipt = async (value: string | null | undefined) => {
  if (!isStoredReceipt(value)) return;
  const { error } = await supabase.storage.from(RECEIPTS_BUCKET).remove([storagePath(value)]);
  if (error) console.error('Failed to remove receipt file', error);
};

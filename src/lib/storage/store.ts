import { del, head } from "@vercel/blob";

/** The small surface the rest of the app needs from a file store, so the provider can change. */
export type FileStore = {
  /** Size and content type of a stored file; throws when it does not exist. */
  inspect(url: string): Promise<{ size: number; contentType: string }>;
  remove(url: string): Promise<void>;
};

export const PROVIDER = "vercel_blob";

/** Uploads need a Vercel Blob store linked to the project (it adds BLOB_READ_WRITE_TOKEN). */
export function uploadsConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export const vercelBlobStore: FileStore = {
  async inspect(url) {
    const h = await head(url);
    return { size: h.size, contentType: h.contentType };
  },
  async remove(url) {
    await del(url);
  },
};

type UploadAttempt<T> =
  | { ok: true; value: T }
  | { error: unknown; ok: false };

export async function attemptScreenshotUpload<T>(
  upload: () => Promise<T>
): Promise<UploadAttempt<T>> {
  try {
    return { ok: true, value: await upload() };
  } catch (error) {
    return { error, ok: false };
  }
}

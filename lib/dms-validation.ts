import { prisma } from "@/lib/prisma";

const DEFAULTS = {
  max_file_size_mb:     10,
  max_files_per_upload: 20,
};

/**
 * Validates an array of files against the DmsSettings for the given company.
 * Throws a descriptive Error if validation fails.
 * Returns true if all checks pass.
 *
 * @param files      - Array of File objects (or any object with a `name` and `size` in bytes)
 * @param company_id - The company's ID from the JWT session
 */
export async function validateUpload(
  files: { name: string; size: number }[],
  company_id: string,
): Promise<true> {
  const settings = await prisma.dmsSettings.findUnique({
    where:  { company_id },
    select: { max_file_size_mb: true, max_files_per_upload: true },
  });

  const maxFiles   = settings?.max_files_per_upload ?? DEFAULTS.max_files_per_upload;
  const maxSizeMb  = settings?.max_file_size_mb     ?? DEFAULTS.max_file_size_mb;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  if (files.length > maxFiles) {
    throw new Error(
      `Too many files. Maximum allowed per upload is ${maxFiles} (received ${files.length}).`,
    );
  }

  for (const file of files) {
    if (file.size > maxSizeBytes) {
      throw new Error(
        `File "${file.name}" exceeds the maximum allowed size of ${maxSizeMb} MB ` +
        `(file is ${(file.size / 1024 / 1024).toFixed(2)} MB).`,
      );
    }
  }

  return true;
}

/**
 * File utility functions for preserving file permissions during copy operations
 */

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Copy a file while preserving its mode (permissions)
 *
 * @param args - Copy arguments
 * @param args.src - Source file path
 * @param args.dest - Destination file path
 */
export const copyFilePreservingMode = async (args: {
  src: string;
  dest: string;
}): Promise<void> => {
  const { src, dest } = args;

  // Copy the file
  await fs.copyFile(src, dest);

  // Get source file mode and apply to destination
  const srcStat = await fs.stat(src);
  await fs.chmod(dest, srcStat.mode);
};

/**
 * Copy a directory recursively while preserving file modes (permissions)
 *
 * @param args - Copy arguments
 * @param args.src - Source directory path
 * @param args.dest - Destination directory path
 */
export const copyDirPreservingMode = async (args: {
  src: string;
  dest: string;
}): Promise<void> => {
  const { src, dest } = args;

  // Get source directory mode
  const srcStat = await fs.stat(src);

  // Create destination directory with same mode
  await fs.mkdir(dest, { recursive: true, mode: srcStat.mode });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirPreservingMode({ src: srcPath, dest: destPath });
    } else {
      await copyFilePreservingMode({ src: srcPath, dest: destPath });
    }
  }
};

/**
 * Write content to a file, preserving the mode of the source file if provided
 *
 * @param args - Write arguments
 * @param args.destPath - Destination file path
 * @param args.content - Content to write
 * @param args.srcPath - Optional source file path to copy mode from
 */
export const writeFilePreservingMode = async (args: {
  destPath: string;
  content: string;
  srcPath?: string | null;
}): Promise<void> => {
  const { destPath, content, srcPath } = args;

  await fs.writeFile(destPath, content);

  // If source path provided, preserve its mode
  if (srcPath != null) {
    const srcStat = await fs.stat(srcPath);
    await fs.chmod(destPath, srcStat.mode);
  }
};

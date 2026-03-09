import fs from 'fs';
import path from 'path';
import { createBrotliCompress } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const sourceDir = path.resolve('workspace/toCompress');
const destDir = path.resolve('workspace/compressed');
const archivePath = path.join(destDir, 'archive.br');

async function getFiles(dir, base = dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files = files.concat(await getFiles(fullPath, base));
    } else {
      files.push({
        fullPath,
        relativePath: path.relative(base, fullPath),
      });
    }
  }

  return files;
}

const compressDir = async () => {
  try {
    await fs.promises.access(sourceDir);
    await fs.promises.mkdir(destDir, { recursive: true });

    const files = await getFiles(sourceDir);

    const brotli = createBrotliCompress();
    const writeStream = fs.createWriteStream(archivePath);

    const archiveStream = new Readable({
      async read() {
        if (this.started) return;
        this.started = true;

        for (const file of files) {
          const stat = await fs.promises.stat(file.fullPath);

          const header = `FILE:${file.relativePath}\nSIZE:${stat.size}\n\n`;
          this.push(header);

          const fileStream = fs.createReadStream(file.fullPath);

          for await (const chunk of fileStream) {
            this.push(chunk);
          }

          this.push('\nEND\n');
        }

        this.push(null);
      },
    });

    await pipeline(archiveStream, brotli, writeStream);
  } catch (e){
    throw new Error('FS operation failed');
  }
};

await compressDir();

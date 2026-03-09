import fs from 'fs';
import path from 'path';
import { createBrotliDecompress } from 'zlib';

const archivePath = path.resolve('workspace/compressed/archive.br');
const outputDir = path.resolve('workspace/decompressed');

const decompressDir = async () => {
  try {
    await fs.promises.access(archivePath);
    await fs.promises.mkdir(outputDir, { recursive: true });

    const readStream = fs.createReadStream(archivePath);
    const brotli = createBrotliDecompress();

    const stream = readStream.pipe(brotli);

    let buffer = '';
    let currentFileStream = null;

    for await (const chunk of stream) {
      buffer += chunk.toString();

      while (true) {
        if (!currentFileStream) {
          const headerMatch = buffer.match(
            /^FILE:(.+)\nSIZE:(\d+)\n\n/
          );

          if (!headerMatch) break;

          const relativePath = headerMatch[1];
          const size = Number(headerMatch[2]);

          buffer = buffer.slice(headerMatch[0].length);

          const filePath = path.join(outputDir, relativePath);

          await fs.promises.mkdir(path.dirname(filePath), {
            recursive: true,
          });

          currentFileStream = {
            stream: fs.createWriteStream(filePath),
            remaining: size,
          };
        }

        if (currentFileStream) {
          const writeSize = Math.min(
            buffer.length,
            currentFileStream.remaining
          );

          const data = buffer.slice(0, writeSize);

          currentFileStream.stream.write(data);

          buffer = buffer.slice(writeSize);
          currentFileStream.remaining -= writeSize;

          if (currentFileStream.remaining === 0) {
            currentFileStream.stream.end();
            currentFileStream = null;

            if (buffer.startsWith('\nEND\n')) {
              buffer = buffer.slice(5);
            }
          } else {
            break;
          }
        }
      }
    }
  } catch {
    throw new Error('FS operation failed');
  }
};

await decompressDir();

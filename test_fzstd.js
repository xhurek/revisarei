import { decompress } from 'fzstd';
import fs from 'fs';

const zstdMagic = Buffer.from([0x28, 0xB5, 0x2F, 0xFD, 0x00, 0x58, 0x20, 0x00, 0x00]); 
// This is not a valid full ZSTD stream, but just to check if it throws or what
try {
  decompress(zstdMagic);
} catch (e) {
  console.log("Error:", e.message);
}

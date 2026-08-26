const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function otfToWoff(otfBuffer) {
  // Read SFNT Header (12 bytes)
  const flavor = otfBuffer.readUInt32BE(0); // 0x4F54544F ('OTTO') or 0x00010000 ('\0\1\0\0')
  const numTables = otfBuffer.readUInt16BE(4);
  const searchRange = otfBuffer.readUInt16BE(6);
  const entrySelector = otfBuffer.readUInt16BE(8);
  const rangeShift = otfBuffer.readUInt16BE(10);

  // Read SFNT Table Directory entries (16 bytes each)
  const tables = [];
  let sfntOffset = 12;
  for (let i = 0; i < numTables; i++) {
    const tag = otfBuffer.toString('ascii', sfntOffset, sfntOffset + 4);
    const checkSum = otfBuffer.readUInt32BE(sfntOffset + 4);
    const offset = otfBuffer.readUInt32BE(sfntOffset + 8);
    const length = otfBuffer.readUInt32BE(sfntOffset + 12);
    sfntOffset += 16;

    const data = otfBuffer.slice(offset, offset + length);
    const compressed = zlib.deflateSync(data);

    // If compression is not smaller, use uncompressed
    const useCompressed = compressed.length < data.length;
    const compData = useCompressed ? compressed : data;

    tables.push({
      tag,
      checkSum,
      origLength: length,
      compData,
      compLength: compData.length,
    });
  }

  // Calculate WOFF header & directory size
  const woffHeaderSize = 44;
  const woffDirSize = numTables * 20;
  let currentOffset = woffHeaderSize + woffDirSize;

  // Calculate offsets for table data with 4-byte alignment
  for (const table of tables) {
    // Pad to 4-byte boundary
    const pad = (4 - (currentOffset % 4)) % 4;
    currentOffset += pad;
    table.woffOffset = currentOffset;
    currentOffset += table.compLength;
  }

  const totalWoffLength = currentOffset;

  // Build WOFF buffer
  const woffBuffer = Buffer.alloc(totalWoffLength);

  // WOFF Header
  woffBuffer.write('wOFF', 0, 4, 'ascii'); // signature
  woffBuffer.writeUInt32BE(flavor, 4); // flavor
  woffBuffer.writeUInt32BE(totalWoffLength, 8); // length
  woffBuffer.writeUInt16BE(numTables, 12); // numTables
  woffBuffer.writeUInt16BE(0, 14); // reserved
  woffBuffer.writeUInt32BE(otfBuffer.length, 16); // totalSfntSize
  woffBuffer.writeUInt16BE(1, 20); // majorVersion
  woffBuffer.writeUInt16BE(0, 22); // minorVersion
  woffBuffer.writeUInt32BE(0, 24); // metaOffset
  woffBuffer.writeUInt32BE(0, 28); // metaLength
  woffBuffer.writeUInt32BE(0, 32); // metaOrigLength
  woffBuffer.writeUInt32BE(0, 36); // privOffset
  woffBuffer.writeUInt32BE(0, 40); // privLength

  // Table Directory (20 bytes per table)
  let dirOffset = 44;
  for (const table of tables) {
    woffBuffer.write(table.tag, dirOffset, 4, 'ascii');
    woffBuffer.writeUInt32BE(table.woffOffset, dirOffset + 4);
    woffBuffer.writeUInt32BE(table.compLength, dirOffset + 8);
    woffBuffer.writeUInt32BE(table.origLength, dirOffset + 12);
    woffBuffer.writeUInt32BE(table.checkSum, dirOffset + 16);
    dirOffset += 20;

    // Write table data
    table.compData.copy(woffBuffer, table.woffOffset);
  }

  return woffBuffer;
}

const sourceDir = 'C:\\Users\\HomePC\\AppData\\Local\\Microsoft\\Windows\\Fonts';
const targetDir = path.join(__dirname, '..', 'public', 'fonts');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const fontFiles = fs.readdirSync(sourceDir).filter(f => f.toLowerCase().includes('manrope') && f.endsWith('.otf'));

console.log(`Found ${fontFiles.length} Manrope font files.`);

for (const file of fontFiles) {
  const srcPath = path.join(sourceDir, file);
  const otfData = fs.readFileSync(srcPath);
  
  // Also copy original OTF
  const otfDest = path.join(targetDir, file);
  fs.writeFileSync(otfDest, otfData);

  // Convert to WOFF
  const woffName = file.replace(/\.otf$/i, '.woff');
  const woffDest = path.join(targetDir, woffName);
  const woffData = otfToWoff(otfData);
  fs.writeFileSync(woffDest, woffData);

  console.log(`Converted ${file} (${otfData.length} bytes) -> ${woffName} (${woffData.length} bytes)`);
}

console.log('Font conversion complete!');

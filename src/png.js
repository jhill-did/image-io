const zlib = require('zlib');
const { crc32 } = require('crc');

const Util = require('./util.js');
const { Image } = require('./image.js');

const headerSize = 8;
const chunkHeaderSize = 8;
const crcSize = 4;

async function decode(fileData) {
  const header = parseHeader(fileData);
  const chunkList = parseChunks(fileData);

  const ihdrChunk = chunkList.find(c => c.type === 'IHDR');
  const ihdrData = parseIHDR(ihdrChunk);
  console.log(header, ihdrData);

  // Combine our IDAT chunks' data together, then uncompress.
  const idatChunks = chunkList.filter(c => c.type === 'IDAT').map(c => c.data);
  const deflatedData = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(deflatedData);

  const { width, height } = ihdrData;
  const lineWidth = width
    * (ihdrData.bitDepth / 8)
    * ihdrData.getChannelCount()
    + 1; // Plus 1 for the filter type.

  const decodedScanlines = [];
  for (let y = 0; y < height; y += 1) {
    const lineOffset = y * lineWidth;
    const currentScanline = decompressed.slice(lineOffset, lineOffset + lineWidth);
    const filterType = currentScanline[0];

    const decodedScanline = Buffer.alloc(lineWidth - 1); // Drop the filter type.

    const getLeft = (index) => {
      const roundedBpp = Math.max(ihdrData.getBitsPerPixel() / 8, 1);
      const adjustedIndex = index - roundedBpp;
      return adjustedIndex < 0 ? 0 : decodedScanline[adjustedIndex];
    };

    const getUp = (index) => {
      return y - 1 < 0 ? 0 : decodedScanlines[y - 1][index];
    };

    const getUpperLeft = (index) => {
      const roundedBpp = Math.max(ihdrData.getBitsPerPixel() / 8, 1);
      const adjustedIndex = index - roundedBpp;
      if (adjustedIndex < 0 || y - 1 < 0) {
        return 0;
      }

      return decodedScanlines[y - 1][adjustedIndex];
    }

    let decoder;
    if (filterType === 0) {
      decoder = (value) => { return value; };
    }

    // Left
    if (filterType === 1) {
      decoder = (value, index) => {
        const prior = getLeft(index);
        return (value + prior) % 256;
      }
    }

    // Up
    if (filterType === 2) {
      decoder = (value, index) => {
        return (value + getUp(index)) % 256;
      }
    }

    // Average
    if (filterType === 3) {
      decoder = (value, index) => {
        const up = getUp(index);
        const left = getLeft(index);
        const average = (up + left) / 2
        return (value + Math.floor(average)) % 256;
      }
    }

    // Paeth
    if (filterType === 4) {
      decoder = (value, index) => {
        const paeth = paethPredictor(
          getLeft(index),
          getUp(index),
          getUpperLeft(index),
        );

        return (value + paeth) % 256;
      };
    }

    for (let index = 0; index < lineWidth; index += 1) {
      // Always skip the first byte of a scanline which denotes the scanline
      // filter type.
      const currentValue = currentScanline[index + 1];

      // Apply our decoder transformation depending on our scanline filter type.
      decodedScanline[index] = decoder(currentValue, index);
    }

    decodedScanlines.push(decodedScanline);
  }

  const image = new Image(
    decodedScanlines,
    ihdrData.getChannelCount(),
    ihdrData.bitDepth
  );

  return image;
}

// TODO: Take options for interlacing, palette, bit depth < 8.
// TODO: Actually perform filtering.
function encode(image) {
  const { scanlines, channelCount, bitsPerPixel } = image;

  const makeChunkBuffer = (chunkType, data) => {
    // 4 bytes for length, 4 for chunkType, and 4 for crc.
    // Chunk wrapping is 12 bytes in size.
    const length = data.length;
    const crc = crc32(data).toString(16);

    // Convert chunkType to hex number.
    const typeHexString = chunkType
      .split('')
      .map(c => c.charCodeAt(0).toString(16))
      .join('');

    const buffer = Buffer.alloc(length + 12);
    let offset = 0;
    offset += buffer.writeUInt32BE(length, offset);
    offset += buffer.write(typeHexString, offset, 4, 'hex');
    offset += data.copy(buffer, offset);
    offset += buffer.write(crc, offset, 4, 'hex');

    return buffer;
  }

  // Fill out our header
  const headerBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // Fill out our IHDR
  const ihdrData = new IHDR(
    image.width,
    image.height,
    image.bitsPerChannel,
    getColorType(channelCount),
    0, // Default filter method.
    0, // No interlacing.
  ).toBuffer();

  const ihdrChunkBuffer = makeChunkBuffer('IHDR', ihdrData);

  // filter IDAT
  const filteredScanlines = image.scanlines.map((scanline) => {
    // Attach NONE filter type.
    return Buffer.concat([Buffer.from([0x00]), scanline]);
  });

  // Smash scanlines and compress.
  const idatData = Buffer.concat(filteredScanlines);
  const idatCompressed = zlib.deflateSync(idatData);

  const idatChunkBuffer = makeChunkBuffer('IDAT', idatCompressed);

  // write IEND
  const iendChunkBuffer = makeChunkBuffer('IEND', Buffer.alloc(0));

  return Buffer.concat([headerBuffer, ihdrChunkBuffer, idatChunkBuffer, iendChunkBuffer]);
}

function paethPredictor(left, up, upperLeft) {
  // Google Paeth Predictor, probably not too hard to understand,
  // but I don't.
  const estimate = left + up - upperLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpperLeft = Math.abs(estimate - upperLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpperLeft) {
    return left;
  }

  if (distanceUp <= distanceUpperLeft) {
    return up;
  }

  return upperLeft;
};


function parseIHDR(chunk) {
  // Break up the buffer by field lengths, this gives us a 7 length array.
  const fields = Util.readLayout([4, 4, 1, 1, 1, 1, 1], chunk.data);

  // Apply the fields list as arguments to a new IHDR object.
  return new IHDR(...fields);
}

function parseChunks(fileData) {
  let offset = headerSize; // Start reading from right after the header.

  let chunks = [];
  let end = false;
  while (!end) {
    const headerBuffer = fileData.slice(offset, offset + chunkHeaderSize);

    const chunkLength = headerBuffer.slice(0, 4).readUInt32BE(0);
    const chunkType = headerBuffer.slice(4, 8).toString();

    // Move our offset ahead to read the chunk's data.
    offset += chunkHeaderSize;

    const dataBuffer = fileData.slice(offset, offset + chunkLength);

    // Move our offset to read the crc.
    offset += chunkLength;

    const crcBuffer = fileData.slice(offset, offset + crcSize);
    const crc = crcBuffer.readUInt32BE(0);

    // Move ahead to read the next chunk.
    offset += crcSize;

    const chunk = new Chunk(chunkLength, chunkType, dataBuffer, crc);
    chunks.push(chunk);

    if (chunkType === 'IEND') {
      break; // If we've reached our last chunk stop scanning.
    }
  }

  return chunks;
}

function parseHeader(buffer) {
  return buffer.slice(0, headerSize);
}

class Chunk {
  constructor(length, type, data, crc) {
    this.length = length;
    this.type = type;
    this.data = data;
    this.crc = crc;
  }

  isCritical() {
    // A Chunk is critical if the first character of its type is upper case.
    // The Chunk is ancillary if the first character of its type is lower case.
    const firstLetter = this.type[0];
    return firstLetter.toUpperCase() === firstLetter;
  }

  isPublic() {
    const secondLetter = this.type[1];
    return secondLetter.toUpperCase() === secondLetter;
  }

  isCopySafe() {
    const fourthLetter = this.type[3];
    return fourthLetter.toUpperCase() === fourthLetter;
  }
}

function getColorType(channelCount) {
  // 1 (luminance) Grayscale
  // 2 (luminance, a) Grayscale & Alpha
  // 3 (r, g, b) Truecolor,
  // 4 (r, g, b, a) Truecolor & alpha.
  return [0, 4, 2, 6][channelCount - 1];
}

class IHDR {
  constructor (
    width, height, bitDepth,
    colorType, compressionMethod,
    filterMethod, interlaceMethod
  ) {
    this.width = width; // 4 bytes
    this.height = height; // 4 bytes
    this.bitDepth = bitDepth; // 1 byte
    this.colorType = colorType; // 1 byte
    this.compressionMethod = compressionMethod; // 1 byte
    this.filterMethod = filterMethod; // 1 byte
    this.interlaceMethod = interlaceMethod; // 1 byte
  }

  getChannelCount() {
    // Grayscale, Nothing, Truecolor, Indexed, Grayscale & alpha, Nothing, Truecolor & alpha.
    const colorTypeChannelMap = [1, 0, 3, 1, 2, 0, 4];
    return colorTypeChannelMap[this.colorType];
  }

  getBitsPerPixel() {
    // Map our color type to its total channel count.
    // A channel is like red, green, blue, alpha.
    // Ex. Grayscale has 1 channel, Truecolor has RGB for 3 channels.
    // We finally multiply the bitDepth which is our "bits per channel"
    // by our channel count.
    const bpp = this.bitDepth * this.getChannelCount();
    return bpp;
  }

  toBuffer() {
    const buffer = Buffer.alloc(13);
    let offset = 0;
    offset = buffer.writeUInt32BE(this.width, offset);
    offset = buffer.writeUInt32BE(this.height, offset);
    offset = buffer.writeUInt8(this.bitDepth, offset);
    offset = buffer.writeUInt8(this.colorType, offset);
    offset = buffer.writeUInt8(this.compressionMethod, offset);
    offset = buffer.writeUInt8(this.filterMethod, offset);
    offset = buffer.writeUInt8(this.interlaceMethod, offset);

    return buffer;
  }
}

module.exports = { encode, decode };

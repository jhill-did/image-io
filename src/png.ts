import pako from 'pako';
import { crc32 } from 'js-crc';
import * as Util from './util';
import { Image } from './image';

const headerSize = 8;
const chunkHeaderSize = 8;
const crcSize = 4;

const concatBuffers = (buffers: Uint8Array[]) => {
  const totalLength = buffers
    .map(buffer => buffer.length)
    .reduce((a, b) => a + b, 0);

  let offset = 0;
  let acc = new Uint8Array(totalLength);
  for (const buffer of buffers) {
    acc.set(buffer, offset);
    offset += buffer.length;
  }

  return acc;
};

export async function decode(fileData: ArrayBuffer) {
  const header = parseHeader(fileData);
  const chunkList = parseChunks(fileData);

  const ihdrChunk = chunkList.find(c => c.type === 'IHDR');
  const ihdrData = parseIHDR(ihdrChunk);
  console.log(header, ihdrData);

  // Combine our IDAT chunks' data together, then uncompress.
  const idatChunks = chunkList
    .filter(c => c.type === 'IDAT')
    .map(c => new Uint8Array(c.data));

  const deflatedData = concatBuffers(idatChunks);
  const decompressed = pako.inflate(deflatedData);

  const { width, height } = ihdrData;
  const lineWidth = width
    * (ihdrData.bitDepth / 8)
    * ihdrData.getChannelCount()
    + 1; // Plus 1 for the filter type.

  const decodedScanlines: Uint8Array[] = [];
  for (let y = 0; y < height; y += 1) {
    const lineOffset = y * lineWidth;
    const currentScanline = decompressed.slice(lineOffset, lineOffset + lineWidth);
    const filterType = currentScanline[0];

    const decodedScanline = new Uint8Array(lineWidth - 1); // Drop the filter type.

    const getLeft = (index: number) => {
      const roundedBpp = Math.max(ihdrData.getBitsPerPixel() / 8, 1);
      const adjustedIndex = index - roundedBpp;
      return adjustedIndex < 0 ? 0 : decodedScanline[adjustedIndex];
    };

    const getUp = (index: number) => {
      return y - 1 < 0 ? 0 : decodedScanlines[y - 1][index];
    };

    const getUpperLeft = (index: number) => {
      const roundedBpp = Math.max(ihdrData.getBitsPerPixel() / 8, 1);
      const adjustedIndex = index - roundedBpp;
      if (adjustedIndex < 0 || y - 1 < 0) {
        return 0;
      }

      return decodedScanlines[y - 1][adjustedIndex];
    }

    let decoder: (value: number, index: number) => number;
    if (filterType === 0) {
      decoder = (value) => { return value; };
    }

    // Left
    if (filterType === 1) {
      decoder = (value, index) => {
        const prior = getLeft(index);
        return (value + prior) % 256;
      };
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
export function encode(image: Image) {
  const { channelCount } = image;

  const makeChunkBuffer = (chunkType: string, data: Uint8Array) => {
    // 4 bytes for length, 4 for chunkType, and 4 for crc.
    // Chunk wrapping is 12 bytes in size.
    const length = data.byteLength;

    // Convert chunkType to hex number.
    const typeHexCodes = chunkType
      .split('')
      .map(c => c.charCodeAt(0).toString(16))
      .join('');

    const writeString = (view: DataView, hexString: string, offset: number) => {
      const hexCodes = [];
      for (let index = 0; index < hexString.length; index += 2) {
        const hexCode = [...hexString.slice(index, index + 2)]
          .join('')
          .padStart(2, '0');
        
        hexCodes.push(hexCode);
      }

      for (let index = 0; index < hexCodes.length; index += 1) {
        const hexCode = hexCodes[index];
        const integer = Number.parseInt(hexCode, 16);

        const bufferOffset = offset + index;

        view.setUint8(bufferOffset, integer);
      }
    };

    const copyBuffer = (source: Uint8Array, target: Uint8Array, offset: number) => {
      for (let index = 0; index < source.length; index += 1) {
        target[offset + index] = source[index];
      }
    };

    const buffer = new DataView(new Uint8Array(length + 12).buffer);
    let offset = 0;
    buffer.setUint32(offset, length, false);
    offset += 4;
    writeString(buffer, typeHexCodes, offset);
    offset += 4;
    copyBuffer(data, new Uint8Array(buffer.buffer), offset);
    offset += data.length;

    const crcData = buffer.buffer.slice(4, -4);
    const crc = crc32(crcData);
    writeString(buffer, crc, offset);
    offset += 4;

    return buffer;
  }

  // Fill out our header
  const headerBuffer = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // Fill out our IHDR
  const ihdrData = new IHDR(
    image.width,
    image.height,
    image.bitsPerChannel,
    getColorType(channelCount),
    0, // No compression
    0, // Default filter method.
    0, // No interlacing.
  ).toBuffer();

  const ihdrChunkBuffer = makeChunkBuffer('IHDR', new Uint8Array(ihdrData.buffer));

  // filter IDAT
  const filteredScanlines = image.scanlines.map((scanline) => {
    // Attach NONE filter type.
    return concatBuffers([Uint8Array.from([0x00]), Uint8Array.from(scanline)]);
  });

  // Smash scanlines and compress.
  const idatData = concatBuffers(filteredScanlines);
  const idatCompressed = pako.deflate(idatData);

  const idatChunkBuffer = makeChunkBuffer('IDAT', idatCompressed);

  // write IEND
  const iendChunkBuffer = makeChunkBuffer('IEND', new Uint8Array(0));

  const toUint8Array = (view: DataView) => new Uint8Array(view.buffer);

  return concatBuffers([
    headerBuffer,
    toUint8Array(ihdrChunkBuffer),
    toUint8Array(idatChunkBuffer),
    toUint8Array(iendChunkBuffer),
  ]);
}

function paethPredictor(left: number, up: number, upperLeft: number) {
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


function parseIHDR(chunk: Chunk) {
  // Break up the buffer by field lengths, this gives us a 7 length array.
  const [
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
  ] = Util.readLayout([4, 4, 1, 1, 1, 1, 1], chunk.data) as number[];

  // Apply the fields list as arguments to a new IHDR object.
  return new IHDR(
    width,
    height,
    bitDepth,
    colorType,
    compressionMethod,
    filterMethod,
    interlaceMethod,
  );
}

function parseChunks(fileData: ArrayBuffer): Chunk[] {
  let offset = headerSize; // Start reading from right after the header.

  let chunks = [];
  let end = false;
  while (!end) {
    const headerBuffer = fileData.slice(offset, offset + chunkHeaderSize);

    const chunkLength = new DataView(headerBuffer.slice(0, 4)).getUint32(0, false);
    const chunkType = String.fromCharCode(...new Uint8Array(headerBuffer.slice(4, 8)));

    // Move our offset ahead to read the chunk's data.
    offset += chunkHeaderSize;

    const dataBuffer = fileData.slice(offset, offset + chunkLength);

    // Move our offset to read the crc.
    offset += chunkLength;

    const crcBuffer = fileData.slice(offset, offset + crcSize);
    const crc = new DataView(crcBuffer).getUint32(0, false);

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

function parseHeader(buffer: ArrayBuffer) {
  return buffer.slice(0, headerSize);
}

class Chunk {
  length: number;
  type: string;
  data: ArrayBuffer;
  crc: number;

  constructor(
    length: number,
    type: string,
    data: ArrayBuffer,
    crc: number,
  ) {
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

function getColorType(channelCount: number) {
  // 1 (luminance) Grayscale
  // 2 (luminance, a) Grayscale & Alpha
  // 3 (r, g, b) Truecolor,
  // 4 (r, g, b, a) Truecolor & alpha.
  return [0, 4, 2, 6][channelCount - 1];
}

class IHDR {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  compressionMethod: number;
  filterMethod: number;
  interlaceMethod: number;

  constructor (
    width: number,
    height: number,
    bitDepth: number,
    colorType: number,
    compressionMethod: number,
    filterMethod: number,
    interlaceMethod: number,
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
    const buffer = new DataView(new Uint8Array(13).buffer);
    let offset = 0;
    buffer.setUint32(offset, this.width, false);
    offset += 4;
    buffer.setUint32(offset, this.height, false);
    offset += 4;
    buffer.setUint8(offset, this.bitDepth);
    offset += 1;
    buffer.setUint8(offset, this.colorType);
    offset += 1;
    buffer.setUint8(offset, this.compressionMethod);
    offset += 1;
    buffer.setUint8(offset, this.filterMethod);
    offset += 1;
    buffer.setUint8(offset, this.interlaceMethod);
    offset += 1;

    return buffer;
  }
}

const Types = require('./types.js');
const Tag = require('./dng/tag.js');
const Compression = require('./dng/compression.js');
const Interpretation = require('./dng/interpretation.js');
const Orientation = require('./dng/orientation.js');
const Planar = require('./dng/planar.js');
const Util = require('./util.js');

const { Image } = require('./image.js');

function parseIfd(fileData, offset) {
  // Go to the offset and create an IFD.
  // Just has a count in it, it's then followed by [count] IFDEntries.
  const ifdBuffer = fileData.slice(offset);
  const ifd = parseObject(ifdBuffer, ImageFileDirectory);
  const { byteSize } = ImageFileDirectoryEntry;

  const ifdEntries = [];
  for (let index = 0; index < ifd.count; index += 1) {
    const currentOffset = offset + 2
      + index * byteSize;

    const buffer = fileData.slice(currentOffset, currentOffset + byteSize);
    const ifdEntry = parseObject(buffer, ImageFileDirectoryEntry);
    console.log(ifdEntry, Tag.getName(ifdEntry.tag));
    ifdEntries.push(ifdEntry);
  }

  // The next IFD's offset follows the IFDEntries.
  // The offset is a 4 byte uint.
  const nextOffsetData = fileData.slice(offset + 2 + ifd.count * byteSize);
  const nextOffset = nextOffsetData.readUInt32LE(0);

  // returns a list of entries, and the next ifd's offset.
  return [ifdEntries, nextOffset];
}

function decode(fileData) {
  headerBuffer = fileData.slice(0, FileHeader.byteSize);
  const fileHeader = parseObject(headerBuffer, FileHeader);
  console.log(fileHeader);

  // dngs contain our still encoded DNG objects, images will hold our decoded
  // images as we go.
  let dngs = [];
  let images = [];

  // We start our ifdOffset using the one specified in the header.
  // The end of the first IFD tells us where to find the next IFD if one exists.
  let ifdOffset = fileHeader.ifdOffset;

  // Keep reading IFDs while we still have them.
  while (ifdOffset !== 0) {
    const [ifdEntries, nextIfdOffset] = parseIfd(fileData, ifdOffset);
    ifdOffset = nextIfdOffset;

    // Add a new dng and apply the IFD entries to it.
    const dng = dngs[dngs.push(new Dng()) - 1];
    ifdEntries.forEach((ifdEntry) => {
      applyEntry(fileData, dng, ifdEntry);
    });

    // Read strips from dng to make scanlines for abstract image.
    const offsetStart = Array.isArray(dng.stripOffsets) ? dng.stripOffsets[0] : dng.stripOffsets;
    const offsetEnd = (offsetStart
      + Array.isArray(dng.stripByteCounts) ?
        dng.stripByteCounts[0] :
        dng.stripByteCounts
    );
    const stripData = fileData.slice(offsetStart, offsetEnd);

    let scanlines = [];
    for (let row = 0; row < dng.height; row += 1) {
      const offset = row * dng.width * dng.bytesPerSample * dng.samplesPerPixel;
      const end = offset + dng.width * dng.bytesPerSample * dng.samplesPerPixel;
      const scanline = stripData.slice(offset, end);
      scanlines.push(scanline);
    }

    images.push(new Image(scanlines, dng.samplesPerPixel, dng.bitsPerSample));
    console.log('STEP');
  }

  return images;
}

// Modify DNG in place.
function applyEntry(fileData, dng, ifdEntry) {
  const value = readEntryData(fileData, ifdEntry);

  const first = (list) => {
    return Array.isArray(list) || (list[0] !== null && list[0]) !== undefined ?
      list[0] :
      list;
  };

  switch (ifdEntry.tag) {
    case 256: dng.width = value; break;
    case 257: dng.height = value; break;
    case 258:
      // For now, assume each sample has the same bit size.
      // Note: some DNG files only have one bit value 🤔
      const adjusted = first(value);
      dng.bitsPerSample = adjusted;
      dng.bytesPerSample = adjusted / 8;
    case 259: dng.compression = Compression.getType(value); break;
    case 262: dng.interpretation = Interpretation.getType(value); break;
    case 270: dng.imageDescription = first(value); break;
    case 271: dng.make = first(value); break;
    case 272: dng.model = first(value); break;
    case 273: dng.stripOffsets = value; break;
    case 274: dng.orientation = Orientation.getType(value); break;
    case 277: dng.samplesPerPixel = value; break;
    case 278: dng.rowsPerStrip = value; break;
    case 279: dng.stripByteCounts = value; break;
    case 282: dng.xResolution = value; break;
    case 283: dng.yResolution = value; break;
    case 284: dng.planarConfiguration = Planar.getType(value); break;
    case 305: dng.software = first(value); break;
    case 306: dng.date = first(value); break;
    case 315: dng.artist = first(value); break;
    case 50706: dng.dngVersion = first(value); break;
    default: break;
  }
}

function readEntryData(fileData, ifdEntry) {
  const { tag: tagId, type: typeId, count, valueOffset } = ifdEntry;
  const type = Tag.getType(typeId);

  if (!type) {
    return undefined;
  }

  // If the type size * count is less than 4 bytes the actual value is stored
  // in the vlaue offset instead of a literal offset. 🤔 Pretty funny.
  const totalSize = type.size * count;
  if (totalSize <= 4) {
    let adjusted = valueOffset;
    if (type.name === 'ASCII') {
      // Special case for strings, convert our 4 byte value into a buffer.
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(valueOffset);
      adjusted = Types.readLayout([Types.ascii(count)], buffer, false);
    }

    if (type.name === 'Byte') {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32LE(valueOffset);

      adjusted = Types.readLayout([Types.uint8(count)], buffer, false);
    }

    return adjusted;
  }

  let layout = [];
  if (type.name === 'ASCII') {
    // Special case for strings, reapply the node type with a count.
    layout = [Types.ascii(count)];
  } else {
    for (let index = 0; index < count; index += 1) {
      layout.push(type.nodeType);
    }
  }

  const offsetStart = ifdEntry.valueOffset;
  const offsetEnd = offsetStart + totalSize;
  const dataSegment = fileData.slice(offsetStart, offsetEnd);

  return Types.readLayout(layout, dataSegment, false);
}

class Dng {
  constructor() {
    this.width = undefined;
    this.height = undefined;
    this.xResolution = undefined;
    this.yResolution = undefined;
    // TODO: ResolutionUnit
    this.bitsPerSample = undefined;
    this.bytesPerSample = undefined;
    this.samplesPerPixel = undefined;
    this.compression = undefined;
    this.interpretation = undefined;
    this.imageDescription = undefined;
    this.date = undefined;
    this.make = undefined;
    this.model = undefined;
    this.software = undefined;
    this.artist = undefined;
    this.stripOffsets = undefined;
    this.rowsPerStrip = undefined;
    this.stripByteCounts = undefined;
    this.orientation = undefined;
    this.planarConfiguration = undefined;
    this.dngVersion = undefined;
  }
}

function parseObject(buffer, classType) {
  const fields = Types.readLayout(classType.dataLayout, buffer, false);
  return new classType(...fields);
}

class ImageFileDirectoryEntry {
  constructor(tag, type, count, valueOffset) {
    this.tag = tag;
    this.type = type;
    this.count = count;
    this.valueOffset = valueOffset;
  }

  static get byteSize() {
    return 12;
  }

  static get dataLayout() {
    return [
      Types.uint16(),
      Types.uint16(),
      Types.uint32(),
      Types.uint32(),
    ];
  }
}

class ImageFileDirectory {
  constructor(count) {
    this.count = count;
  }

  static get byteSize() {
    return 2;
  }

  static get dataLayout() {
    return [Types.uint16()];
  }
}

class FileHeader {
  constructor(endianness, signature, ifdOffset) {
    this.endianness = endianness;
    this.signature = signature;
    this.ifdOffset = ifdOffset;
  }

  static get byteSize() {
    return 8;
  }

  static get dataLayout() {
    return [
      Types.ascii(2),
      Types.uint16(),
      Types.uint32(),
    ];
  }

  toString() {
    return `
      FileHeader
        Endianness: ${this.endianness}
        Signature: ${this.signature}
        First IFD Offset: ${this.ifdOffset}
    `;
  }
}

module.exports = { decode };

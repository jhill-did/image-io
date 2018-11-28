const Types = require('./types.js');
const Tag = require('./dng/tag.js');
const Compression = require('./dng/compression.js');
const Interpretation = require('./dng/interpretation.js');
const Orientation = require('./dng/orientation.js');
const Planar = require('./dng/planar.js');
const Util = require('./util.js');

const { Image } = require('./image.js');

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
    console.log('nextIfdOffset', ifdOffset);

    // Add a new dng and apply the IFD entries to it.
    console.log('Applying entries.');
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

    console.log('Reading strips.');
    const stripData = fileData.slice(offsetStart, offsetEnd);

    /*
    const getFilterColor = (x, y) => {
      const isEven = value => value % 2 === 0;

      return isEven(x) ?
        (isEven(y) ? [1, 0, 0] : [0, 1, 0]) :
        (isEven(y) ? [0, 1, 0] : [0, 0, 1]);
    };*/

    const filterColors = {
      red : [1, 0, 0],
      green: [0, 1, 0],
      blue: [0, 0, 1],
    };

    const getFilterColor = (x, y) => {
      if (x > dng.width || y > dng.height || x < 0 || y < 0) {
        return null;
      }

      const filter = [
        [filterColors.red, filterColors.green],
        [filterColors.green, filterColors.blue],
      ];

      const height = filter.length;
      const width = filter[0].length;

      return filter[y % height][x % width];
    }

    const scale = (vector, scalar) => {
      return vector.map(component => component * scalar);
    };

    const average = (list) => {
      return list.reduce((acc, item) => { return acc + item; }, 0) / list.length;
    };

    const getPixel = (x, y) => {
      if (x > dng.width || y > dng.height || x < 0 || y < 0) {
        return null;
      }

      const offset = y * dng.width * dng.bytesPerSample * dng.samplesPerPixel
        + x * dng.bytesPerSample * dng.samplesPerPixel;
      const end = offset + dng.bytesPerSample * dng.samplesPerPixel;
      // This is CFA so I know each pixel will be 2 bytes wide.

      const buffer = stripData.slice(offset, end);
      return buffer.readUInt16LE(0);
    }

    const getKernel = (x, y) => {
      return [
        { x: x - 1, y: y - 1}, // Upper row
        { x: x, y: y - 1},
        { x: x + 1, y: y - 1},
        { x: x - 1, y: y }, // Center row
        { x, y },
        { x: x + 1, y: y },
        { x: x - 1, y: y + 1 }, // Bottom row
        { x: x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ];
    }

    console.log('Generating scanlines.\n');

    // Generate scanlines for our abstract image.
    // Convert CFA to RGB
    let scanlines = [];
    for (let y = 0; y < dng.height; y += 1) {
      const scanline = [];
      for (let x = 0; x < dng.width; x += 1) {
        const kernel = getKernel(x, y)
          .filter(item => item.x >= 0
            && item.x < dng.width
            && item.y >= 0
            && item.y < dng.height
          );

        const reds = kernel
          .filter(pos => getFilterColor(pos.x, pos.y) === filterColors.red)
          .map(pos => getPixel(pos.x, pos.y));
        const red = average(reds);

        const greens = kernel
          .filter(pos => getFilterColor(pos.x, pos.y) === filterColors.green)
          .map(pos => getPixel(pos.x, pos.y));
        const green = average(greens) / 1.5;

        const blues = kernel
          .filter(pos => getFilterColor(pos.x, pos.y) === filterColors.blue)
          .map(pos => getPixel(pos.x, pos.y));
        const blue = average(blues);

        const pixelComponents = [
          Math.round(red),
          Math.round(green),
          Math.round(blue)
        ];

        scanline.push(...pixelComponents);
      }

      if (y % 100 === 0) {
        console.log(`\b\r${Math.round(y / dng.height * 100)}%`);
      }

      scanlines.push(scanline);
    }

    console.log(dng);
    // images.push(new Image(scanlines, dng.samplesPerPixel, dng.bitsPerSample));
    images.push(new Image(scanlines, 3, 16));
    console.log('STEP');
  }

  console.log('done decoding');
  return images;
}

function parseIfd(fileData, offset) {
  // Go to the offset and create an IFD.
  // IFDs only have a count in it, it's then followed by [count] IFDEntries.
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
    case 33422: dng.cfaPattern = first(value); break;
    case 50706: dng.dngVersion = first(value); break;
    case 50710: dng.cfaPlaneColor = value; break;
    case 50711: dng.cfaLayout = value; break;
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
    this.cfaPlaneColor = undefined;
    this.cfaLayout = undefined;
    this.cfaPattern = undefined;
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

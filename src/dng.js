const Types = require('./types.js');
const Tag = require('./dng/tag.js');
const Util = require('./util.js');

function decode(fileData) {
  headerBuffer = fileData.slice(0, FileHeader.byteSize);
  const fileHeader = parseObject(headerBuffer, FileHeader);
  console.log(fileHeader);

  const ifdBuffer = fileData.slice(fileHeader.ifdOffset);
  const ifd = parseObject(ifdBuffer, ImageFileDirectory);
  console.log(ifd);

  let ifdEntries = [];
  for (let index = 0; index < ifd.count; index += 1) {
    const { byteSize } = ImageFileDirectoryEntry;
    const currentOffset = fileHeader.ifdOffset + 2
      + index * byteSize;

    const buffer = fileData.slice(currentOffset, currentOffset + byteSize);
    const ifdEntry = parseObject(buffer, ImageFileDirectoryEntry);
    console.log(ifdEntry, Tag.getName(ifdEntry.tag));
    ifdEntries.push(ifdEntry);
  }

  let dng = new Dng();
  ifdEntries.forEach((ifdEntry) => {
    applyEntry(fileData, dng, ifdEntry);
  });

  console.log(dng);
}

// Modify DNG in place.
function applyEntry(fileData, dng, ifdEntry) {
  const value = readEntryData(fileData, ifdEntry);

  switch (ifdEntry.tag) {
    case 256: dng.width = value; break;
    case 257: dng.height = value; break;
    case 258:
      // For now, assume each sample has the same bit size.
      dng.bitsPerSample = value[0];
      dng.bytesPerSample = value[0] / 8;
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
    return valueOffset;
  }

  let layout = [];
  for (let index = 0; index < count; index += 1) {
    layout.push(type.nodeType);
  }

  console.log(tagId, layout);
  console.log(tagId, type, totalSize);
  const offsetStart = ifdEntry.valueOffset;
  const offsetEnd = offsetStart + totalSize;
  const dataSegment = fileData.slice(offsetStart, offsetEnd);
  console.log(tagId, dataSegment);
  return Types.readLayout(layout, dataSegment, false);
}

class Dng {
  constructor() {
    this.width = null;
    this.height = null;
    this.bitsPerSample = null;
    this.bytesPerSample = null;
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

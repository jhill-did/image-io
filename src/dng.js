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
    console.log(ifdEntry, Tag.getName(ifdEntry.tag), Tag.getType(ifdEntry.type));
    ifdEntries.push(ifdEntry);
  }

  // Read anymore IFDs that come after the first one.

  // console.log(ifdEntries);
}

function readEntryData(fileData, ifdEntry) {
  
}

class Dng {
  constructor() {
    this.width = null;
    this.height = null;
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

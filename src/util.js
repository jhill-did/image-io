const fs = require('fs');

function readLayout(layout, data, bigEndian = true) {
  let offset = 0;
  const fields = layout.map((fieldLength) => {
    let field;
    switch (fieldLength) { // in Bytes
      case 1: field = data.readUInt8(offset); break;
      case 2: field = bigEndian ?
        data.readUInt16BE(offset) :
        data.readUInt16LE(offset);
        break;
      case 4: field = bigEndian ?
        data.readUInt32BE(offset) :
        data.readUInt32LE(offset);
        break;
      case 8: field = bigEndian ?
        data.readUInt64BE(offset) :
        data.readUInt64LE(offset);
        break;
      default: break;
    }

    offset += fieldLength;
    return field;
  });

  return fields;
}

function fileReadBuffer(fileHandle, offset, size) {
  const buffer = Buffer.alloc(size);
  const bytesRead = fs.readSync(fileHandle, buffer, 0, size, offset);

  // If we've reached the end of the file, return an error.
  let error = false;
  if (bytesRead < size) {
    error = true;
  }

  return [buffer, error];
}

// Map inputBuffer's values to outputBuffer, unless outputBuffer doesn't
// exist. In which case map inputBuffer's values onto itself in-place.
function mapBuffer(inputBuffer, lambda, outputBuffer) {
  for (let index = 0; index < inputBuffer.length; index += 1) {
    if (outputBuffer) {
      outputBuffer[index] = lambda(inputBuffer[index]);
    } else {
      inputBuffer[index] = lambda(inputBuffer[index]);
    }
  }
}

const getMaxValue = (byteCount) => {
  let output = 0;
  for (let index = 0; index < byteCount; index += 1) {
    output = output << 8;
    output = output | 0xFF;
  }
  return output;
}

module.exports = { readLayout, fileReadBuffer, mapBuffer, getMaxValue };

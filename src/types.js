
const typenames = [
  'ascii',
  'int8',
  'uint8',
  'int16',
  'uint16',
  'int32',
  'uint32',
  'int64',
  'uint64',
  'float',
  'double',
];

const types = typenames.reduce((acc, name) => {
  return {
    ...acc,
    [name]: (count = 1) => { return { name, count }; },
  }
}, {});

function readLayout(layout, buffer, bigEndian = true) {
  let offset = 0;
  const fields = layout.map((type) => {
    let container = [];
    for (let index = 0; index < type.count; index += 1) {
      const [value, bytesRead] = read(type, buffer, offset, bigEndian);
      offset += bytesRead;
      container.push(value);
    }

    // Special case for returning a string to ascii types.
    if (type.name === 'ascii') {
      return container.join('');
    }

    // If we only had one item return it on its own, otherwise return everything.
    return container.length > 1 ? container : container[0];
  });

  return fields;
}

function read(type, buffer, offset, bigEndian = true) {
  let bytesRead = 0;
  let value = null;
  switch (type.name) {
    case 'ascii':
      value = String.fromCharCode(buffer.readUInt8(offset));
      bytesRead = 1;
      break;
    case 'int8': value = buffer.readInt8(offset); bytesRead = 1; break;
    case 'uint8': value = buffer.readUInt8(offset); bytesRead = 1; break;
    case 'int16':
      value = bigEndian ? buffer.readInt16BE(offset) : buffer.readInt16LE(offset);
      bytesRead = 2;
      break;
    case 'uint16':
      value = bigEndian ? buffer.readUInt16BE(offset) : buffer.readUInt16LE(offset);
      bytesRead = 2;
      break;
    case 'int32':
      value = bigEndian ? buffer.readInt32BE(offset) : buffer.readInt32LE(offset);
      bytesRead = 4;
      break;
    case 'uint32':
      value = bigEndian ? buffer.readUInt32BE(offset) : buffer.readUInt32LE(offset);
      bytesRead = 4;
      break;
    case 'int64':
      value = bigEndian ? buffer.readInt64BE(offset) : buffer.readInt64LE(offset);
      bytesRead = 8;
      break;
    case 'uint64':
      value = bigEndian ? buffer.readUInt64BE(offset) : buffer.readUInt64LE(offset);
      bytesRead = 8;
      break;
    case 'float':
      value = bigEndian ? buffer.readFloatBE(offset) : buffer.readFloatLE(offset);
      bytesRead = 4;
      break;
    case 'double':
      value = bigEndian ? buffer.readDoubleBE(offset) : buffer.readDoubleLE(offset);
      bytesRead = 8;
      break;
    default: break;
  }

  return [value, bytesRead];
}

module.exports = { ...types, readLayout };

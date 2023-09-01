
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
] as const;

type TypeName = (typeof typenames)[number];
type LayoutItem = { name: string, count: number };
type TypeFactory = (count?: number) => LayoutItem;
export const types: Record<TypeName, TypeFactory> = (
  typenames.reduce((acc, name) => {
    return {
      ...acc,
      [name]: (count = 1) => ({ name, count }),
    };
  }, {}) as any
);

export function readLayout(
  layout: LayoutItem[],
  buffer: ArrayBuffer,
  bigEndian = true,
) {
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
      // Remove ascii null terminators.
      const terminatorIndex = container.indexOf('\u0000');
      if (terminatorIndex > -1) {
        container.splice(terminatorIndex, 1);
      }

      return container.join('');
    }

    // If we only had one item return it on its own, otherwise return everything.
    return container.length > 1 ? container : container[0];
  });

  return fields;
}

function read(
  type: LayoutItem,
  buffer: ArrayBuffer,
  offset: number,
  bigEndian = true,
): [string | number | bigint, number] {
  const view = new DataView(buffer);
  let bytesRead = 0;
  let value = null;
  switch (type.name) {
    case 'ascii':
      value = String.fromCharCode(view.getUint8(offset));
      bytesRead = 1;
      break;
    case 'int8': value = view.getInt8(offset); bytesRead = 1; break;
    case 'uint8': value = view.getUint8(offset); bytesRead = 1; break;
    case 'int16':
      value = view.getInt16(offset, !bigEndian);
      bytesRead = 2;
      break;
    case 'uint16':
      value = view.getUint16(offset, !bigEndian);
      bytesRead = 2;
      break;
    case 'int32':
      value = view.getInt32(offset, !bigEndian);
      bytesRead = 4;
      break;
    case 'uint32':
      value = view.getUint32(offset, !bigEndian);
      bytesRead = 4;
      break;
    case 'int64':
      value = view.getBigInt64(offset, !bigEndian);
      bytesRead = 8;
      break;
    case 'uint64':
      value = view.getBigUint64(offset, !bigEndian);
      bytesRead = 8;
      break;
    case 'float':
      value = view.getFloat32(offset, !bigEndian);
      bytesRead = 4;
      break;
    case 'double':
      value = view.getFloat64(offset, !bigEndian);
      bytesRead = 8;
      break;
    default: break;
  }

  return [value, bytesRead];
}

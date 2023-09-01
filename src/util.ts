export function readLayout(
  layout: number[],
  data: ArrayBuffer,
  bigEndian = true,
) {
  let offset = 0;
  const view = new DataView(data);
  const fields = layout.map((fieldLength) => {
    let field;
    switch (fieldLength) { // in Bytes
      case 1: field = view.getUint8(offset); break;
      case 2: field = view.getUint16(offset, !bigEndian); break;
      case 4: field = view.getUint32(offset, !bigEndian); break;
      case 8: field = view.getBigUint64(offset, !bigEndian); break;
      default: break;
    }

    offset += fieldLength;
    return field;
  });

  return fields;
}

// Map inputBuffer's values to outputBuffer, unless outputBuffer doesn't
// exist. In which case map inputBuffer's values onto itself in-place.
export function mapBuffer(inputBuffer: any, lambda: any, outputBuffer: any) {
  for (let index = 0; index < inputBuffer.length; index += 1) {
    if (outputBuffer) {
      outputBuffer[index] = lambda(inputBuffer[index]);
    } else {
      inputBuffer[index] = lambda(inputBuffer[index]);
    }
  }
}

export const getMaxValue = (byteCount: number) => {
  let output = 0;
  for (let index = 0; index < byteCount; index += 1) {
    output = output << 8;
    output = output | 0xFF;
  }
  return output;
};

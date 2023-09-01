
const compressionTypeMap = {
  '1': { id: 1, name: 'No Compresion' },
  '2': { id: 2,  name: 'CCITT modified Huffman RLE' },
  '3': { id: 3, name: 'CCITT Group 3' },
  '4': { id: 4, name: 'CCITT Group 4' },
  '5': { id: 5, name: 'LZW' },
  '6': { id: 6, name: 'JPEG (Old-Style)' },
  '7': { id: 7, name: 'JPEG (New-Style)' },
  '8': { id: 8, name: 'Deflate (Adobe-Style)' },
  '9': { id: 9, name: 'JBIG on White & Black' },
  '10': { id: 10, name: 'JBIG on Color' },
  '32773': { id: 32773, name: 'PackBits compression, aka Macintosh RLE' },
};

type TypeId = keyof(typeof compressionTypeMap);

export function getType(typeId: TypeId) {
  return compressionTypeMap[`${typeId}`];
}


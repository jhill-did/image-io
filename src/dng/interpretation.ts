
const interpretationTypeMap = {
  '0': { id: 0, name: 'WhiteIsZero' },
  '1': { id: 1, name: 'BlackIsZero' },
  '2': { id: 2, name: 'RGB' }, // (0,0,0) to (255,255,255);
  '3': { id: 3, name: 'Palette color' }, // Index from ColorMap entry.
  '4': { id: 4, name: 'Transparency Mask' },
  '5': { id: 5, name: 'Seperated, usually CMYK' },
  '6': { id: 6, name: 'YCbCr' },
  '8': { id: 8, name: 'CIE L*a*b*' },
  '9': { id: 9, name: 'ICC L*a*b*' },
  '10': { id: 10, name: 'ITU L*a*b*' },
  '32803': { id: 32803, name: 'CFA (Color Filter Array)' },
  '34892': { id: 34892, name: 'LinearRaw' },
};

type InterpretationType = keyof(typeof interpretationTypeMap);

export function getType(interpretationType: InterpretationType) {
  return interpretationTypeMap[`${interpretationType}`];
}

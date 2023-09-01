
const patternMap = [
  'Red',
  'Green',
  'Blue',
  'Cyan',
  'Magenta',
  'Yellow',
  'White',
];

export function getColors(pattern: number[]) {
  return pattern.map(colorIndex => patternMap[colorIndex]);
}

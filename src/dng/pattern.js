
const patternMap = [
  'Red',
  'Green',
  'Blue',
  'Cyan',
  'Magenta',
  'Yellow',
  'White',
];

function getColors(pattern) {
  return pattern.map(item => patternMap[colorIndex]);
}

module.exports = { getColors };

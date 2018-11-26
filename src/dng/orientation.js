
const orientationMap = [
  { id: 1, name: 'Top Left' },
  { id: 2, name: 'Top Right' },
  { id: 3, name: 'Bottom Right' },
  { id: 4, name: 'Bottom Left' },
  { id: 5, name: 'Left Top' },
  { id: 6, name: 'Right Top' },
  { id: 7, name: 'Right Bottom' },
  { id: 8, name: 'Left Bottom' },
];

function getType(orientationId) {
  return orientationMap[orientationId - 1];
}

module.exports = { getType };

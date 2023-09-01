
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

export function getType(orientationId: number) {
  return orientationMap[orientationId - 1];
}

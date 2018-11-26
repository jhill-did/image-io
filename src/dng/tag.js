const Types = require('../types.js');

const nameMap = {
  '254': 'NewSubfileType',
  '255': 'SubfileType',
  '256': 'ImageWidth',
  '257': 'ImageLength',
  '258': 'BitsPerSample',
  '259': 'Compression',
  '262': 'PhotometricInterpretation',
  '263': 'Threshholding',
  '264': 'CellWidth',
  '265': 'CellLength',
  '266': 'FillOrder',
  '270': 'ImageDescription',
  '271': 'Make',
  '272': 'Model',
  '273': 'StripOffsets',
  '274': 'Orientation',
  '277': 'SamplesPerPixel',
  '278': 'RowsPerStrip',
  '279': 'StripByteCounts',
  '280': 'MinSampleValue',
  '281': 'MaxSampleValue',
  '282': 'XResolution',
  '283': 'YResolution',
  '284': 'PlanarConfiguration',
  '288': 'FreeOffsets',
  '289': 'FreeByteCounts',
  '290': 'GrayResponseUnit',
  '291': 'GrayResponseCurve',
  '296': 'ResolutionUnit',
  '305': 'Software',
  '306': 'DateTime',
  '315': 'Artist',
  '316': 'HostComputer',
  '320': 'ColorMap',
  '330': 'SubIFDs',
  '338': 'ExtraSamples',
  '529': 'YCbCrCoefficients',
  '530': 'YCbCrSubSampling',
  '531': 'YCbCrPositioning',
  '532': 'ReferenceBlackWhite',
  '33432': 'Copyright',
  '34665': 'Exif IFD',
  '34853': 'GPS IFD',
  '50706': 'DNGVersion',
  '50707': 'DNGBackwardVersion',
  '50708': 'UniqueCameraModel',
  '50721': 'ColorMatrix1',
  '50722': 'ColorMatrix2',
  '50723': 'CameraCalibration1',
  '50724': 'CameraCalibration2',
  '50727': 'AnalogBalance',
  '50728': 'AsShotNeutral',
  '50730': 'BaselineExposure',
  '50731': 'BaselineNoise',
  '50732': 'BaselineSharpness',
  '50734': 'LinearResponseLimit',
  '50739': undefined,
  '50741': 'MakerNoteSafety',
  '50778': 'CalibrationIlluminant1',
  '50779': 'CalibrationIlluminant2',
  '50781': undefined,
  '50936': undefined,
  '50941': undefined,
  '51041': undefined,
  '51111': undefined,
}

function getName(tag) {
  return nameMap[`${tag}`];
}

const typeMap = [
  { name: 'Byte', size: 1, nodeType: Types.uint8() },
  { name: 'ASCII', size: 1, nodeType: Types.ascii() },
  { name: 'Short', size: 2, nodeType: Types.uint16() },
  { name: 'Long', size: 4, nodeType: Types.uint32() },
  { name: 'Rational', size: 8, nodeType: Types.uint32(2) }, // (2 longs), first half is numerator, second is denominator.
  { name: 'SByte', size: 1, nodeType: Types.int8() },
  { name: 'Undefined', size: 1, nodeType: Types.uint8() }, // (8bit void type)
  { name: 'SShort', size: 2, nodeType: Types.int16() },
  { name: 'SLong', size: 4, nodeType: Types.int32() },
  { name: 'SRational', size: 8, nodeType: Types.int32(2) }, // (2 slongs)
  { name: 'Float', size: 4, nodeType: Types.float() },
  { name: 'Double', size: 8, nodeType: Types.double() },
];

function getType(typeId) {
  return typeMap[typeId + 1];
}

module.exports = { getName, getType };

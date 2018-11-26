const Util = require('./util.js');

function encode(image) {
  const {
    bytesPerChannel,
    channelCount,
    width,
    height,
  } = image;

  let ppmData = '';
  const maximumValue = Util.getMaxValue(bytesPerChannel);
  ppmData += `P3\n${width} ${height}\n${maximumValue}\n`;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      let { red, green, blue, alpha } = image.getPixel(x, y);

      if (alpha !== undefined) {
        const multiplier = alpha / maximumValue;
        red = red * multiplier;
        green = green * multiplier;
        blue = blue * multiplier;
      }

      ppmData += `${red} ${green} ${blue}\n`;
    }
  }

  return ppmData;
}

module.exports = { encode };

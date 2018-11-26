
const Color = require('./color.js');

class Image {
  constructor(scanlines, channelCount, bitsPerChannel) {
    this.scanlines = scanlines;
    this.channelCount = channelCount;
    this.bitsPerChannel = bitsPerChannel;
    this.bytesPerPixel = channelCount * (bitsPerChannel / 8);
    this.bytesPerChannel = bitsPerChannel / 8;

    this.width = scanlines[0].length / this.bytesPerPixel;
    this.height = scanlines.length;
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  getPixel(x, y) {
    if (!this.inbounds()) {
      return null;
    }

    let pixelData = [];
    for (let index = 0; index < this.channelCount; index += 1) {
      const bufferOffset = index * this.bytesPerChannel;
      pixelData[index] = this.scanlines[y][x * this.bytesPerPixel + bufferOffset];
    }

    return new Color(...pixelData);
  }

  setPixel(x, y, color) {
    if (!this.inbounds()) {
      return;
    }

    const { red, green, blue, alpha } = color;

    const scanline = this.scanlines[y];
    const offset = x * this.bytesPerPixel;
    if (red !== undefined) { scanline[offset + 0] = red; }
    if (green !== undefined) { scanline[offset + 1] = green; }
    if (blue !== undefined) { scanline[offset + 2] = blue; }
    if (alpha !== undefined) { scanline[offset + 3] = alpha; }
  }

  inbounds(x, y) {
    return !(x < 0 || x > this.width || y < 0 || y > this.height);
  }

  clone() {
    // Clone buffers.
    const copiedData = this.scanlines.map((scanline) => {
      return Buffer.from(scanline);
    });

    return new Image(copiedData, this.channelCount, this.bitsPerChannel);
  }
}

function makeImage(width, height, channelCount = 4) {
  const scanlines = [];
  for (let row = 0; row < height; row += 1) {
    scanlines.push(Buffer.alloc(width * channelCount));
  }

  console.log(width, height, channelCount);
  return new Image(scanlines, channelCount, 8);
}

module.exports = { Image, makeImage };

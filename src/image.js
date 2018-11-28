
const Color = require('./color.js');

class Image {
  constructor(scanlines, channelCount, bitsPerChannel) {
    // Scanlines are always an array of js numbers.
    // Not buffers.
    this.scanlines = scanlines;
    this.channelCount = channelCount;
    this.bitsPerChannel = bitsPerChannel;
    this.bytesPerChannel = bitsPerChannel / 8;
    this.bytesPerPixel = channelCount * this.bytesPerChannel;

    // JS doesn't have specifically sized Numbers, so for us each index from
    // a scanline is going to be one entire channel regardless of the
    // bits per channel.

    // It'll be up to encoders to translate the bytes per channel into the
    // appropriate format for an output buffer.
    this.width = scanlines[0].length / channelCount;
    this.height = scanlines.length;
  }

  getSize() {
    return { width: this.width, height: this.height };
  }

  getPixel(x, y) {
    if (!this.inbounds()) {
      return null;
    }

    const offset = x * this.channelCount;
    const end = offset + this.channelCount;
    const pixelData = this.scanlines[y].slice(offset, end);

    return new Color(...pixelData);
  }

  setPixel(x, y, color) {
    if (!this.inbounds()) {
      return;
    }

    const { red, green, blue, alpha } = color;

    const scanline = this.scanlines[y];
    const offset = x * this.channelCount;
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

function makeImage(width, height, channelCount = 4, bitsPerChannel = 8) {
  const scanlines = [];
  for (let row = 0; row < height; row += 1) {
    scanlines.push(Array(width * channelCount).fill(0));
  }

  console.log(width, height, channelCount);
  return new Image(scanlines, channelCount, bitsPerChannel);
}

module.exports = { Image, makeImage };

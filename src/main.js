const fs = require('fs');

const Png = require('./png.js');
const Dng = require('./dng.js');
const Ppm = require('./ppm.js');
const Color = require('./color.js');
const { Image, makeImage } = require('./image.js');

test('./office.dng');

async function test(filename) {
  const fileSize = fs.statSync(filename).size;
  const fileHandle = fs.openSync(filename, 'r');
  const buffer = Buffer.alloc(fileSize);
  fs.readSync(fileHandle, buffer, 0, fileSize, 0);

  const image = Dng.decode(buffer);

  // const image = await Png.decode(buffer);
  // const modifiedImage = bloom(image);

  // const ppmData = Ppm.encode(blurredImage);
  // fs.writeFileSync('./output.ppm', ppmData);

  // const pngData = Png.encode(modifiedImage);
  // fs.writeFileSync('./output.png', pngData);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function bloom(image) {
  const { width, height } = image;

  const luminanceMap = makeImage(width, height, 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const { red, green, blue } = image.getPixel(x, y);
      const luminance = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);
      const adjustedLuminance = ((luminance / 256) ** 4) * 256

      luminanceMap.setPixel(x, y, new Color(adjustedLuminance));
    }
  }

  const bloom1 = blur(luminanceMap, 8, 32);
  const bloom2 = blur(luminanceMap, 4, 32);

  // Composite blurred luminance with a clamped add.
  const compositeA = makeImage(width, height, 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleA = bloom1.getPixel(x, y);
      const sampleB = image.getPixel(x, y);

      const result = new Color(
        clamp(sampleB.red + sampleA.red, 0, 255),
        clamp(sampleB.green + sampleA.red, 0, 255),
        clamp(sampleB.blue + sampleA.red, 0, 255),
      );

      compositeA.setPixel(x, y, result);
    }
  }

  // Composite blurred luminance with a clamped add.
  const compositeB = makeImage(width, height, 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleA = bloom2.getPixel(x, y);
      const sampleB = compositeA.getPixel(x, y);

      const result = new Color(
        clamp(sampleB.red + sampleA.red, 0, 255),
        clamp(sampleB.green + sampleA.red, 0, 255),
        clamp(sampleB.blue + sampleA.red, 0, 255),
      );

      compositeB.setPixel(x, y, result);
    }
  }

  return compositeB;
}

function distort(image) {
  const wavedImage = image.clone();
  const { width, height } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const clampedX = clamp(Math.round(x + Math.cos(x / 10) * 10), 0, width - 1);
      const clampedY = clamp(Math.round(y), 0, height - 1);
      const sample = image.getPixel(clampedX, clampedY);
      wavedImage.setPixel(x, y, sample);
    }
  }

  return wavedImage;
}

function blur(image, radius = 8, iterations = 16) {
  const blurredImage = image.clone();

  // Apply blur
  const { width, height } = image;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const stepSize = (Math.PI * 2) / iterations;
      let sum = [0, 0, 0];
      for (let angle = 0; angle < Math.PI * 2; angle += stepSize) {
        const sampleX = x + Math.cos(angle) * radius;
        const sampleY = y + Math.sin(angle) * radius;
        const clampedX = Math.round(clamp(sampleX, 0, width - 1));
        const clampedY = Math.round(clamp(sampleY, 0, height - 1));
        const { red, green, blue } = image.getPixel(clampedX, clampedY);
        sum[0] += red;
        sum[1] += green;
        sum[2] += blue;
      }

      const currentColor = image.getPixel(x, y);
      sum[0] += currentColor.red;
      sum[1] += currentColor.green;
      sum[2] += currentColor.blue;

      const average = new Color(
        sum[0] / (iterations + 1),
        sum[1] / (iterations + 1),
        sum[2] / (iterations + 1),
      );

      blurredImage.setPixel(x, y, average);
    }
  }

  return blurredImage;
}

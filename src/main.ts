import * as Png from './png';
import { Dng, decode as decodeDng } from './dng';
import * as Ppm from './ppm';
import { Color } from './color';
import * as Util from './util';
import { Image, makeImage } from './image';

// export function fileReadBuffer(fileHandle, offset, size) {
//   const buffer = new Uint8Array(size);
//   const bytesRead = fs.readSync(fileHandle, buffer, 0, size, offset);

//   // If we've reached the end of the file, return an error.
//   let error = false;
//   if (bytesRead < size) {
//     error = true;
//   }

//   return [buffer, error];
// }

// test('./airport1.DNG');
// hmm();

function hmm() {
  fetch('/test.png')
    .then(response => response.blob())
    .then(blob => blob.arrayBuffer())
    .then(Png.decode)
    .then(console.log);

  const width = 100;
  const height = 100;
  let image = makeImage(width, height, 4, 8);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const color = new Color(
        Math.floor(column / width * 255),
        Math.floor(row / height * 255),
        0,
        255,
      );

      image.setPixel(column, row, color);
    }
  }
  
  // let blurred = blur(image);
  // let ppmData = Ppm.encode(blurred);
  const pngData = Png.encode(image);
  console.log(pngData);
  var blob = new Blob([pngData], { type: 'image/png' });
  var url = URL.createObjectURL(blob);
  var img = document.createElement('img');
  img.src = url;
  document.body.appendChild(img);
  //  fs.writeFileSync('./blurred.ppm', ppmData);
}

hmm();

// async function test(filename) {
//   const fileSize = fs.statSync(filename).size;
//   const fileHandle = fs.openSync(filename, 'r');
//   const buffer = new Uint8Array(fileSize);
//   fs.readSync(fileHandle, buffer, 0, fileSize, 0);

//   const [image] = decodeDng(buffer);

//   // const image = await Png.decode(buffer);
//   const modifiedImage = tonemap(image);
//   //console.log('width', modifiedImage.width);

//   const ppmData = Ppm.encode(modifiedImage);
//   // fs.writeFileSync('./output.ppm', ppmData);

//   // const pngData = Png.encode(modifiedImage);
//   fs.writeFileSync('./output.ppm', ppmData);
// }

function tonemap(image: Image) {
  const adjuster = (value: number) => {
    return value;
  };

  const copy = image.clone();
  let maxValue = Util.getMaxValue(image.bytesPerChannel);
  for (let y = 0; y < copy.height; y += 1) {
    for (let x = 0; x < copy.width; x += 1) {
      let { red, green, blue } = image.getPixel(x, y);
      const luminance = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);

      red = adjuster(red / maxValue) * 256;
      green = adjuster(green / maxValue) * 256;
      blue = adjuster(blue / maxValue) * 256;

      copy.setPixel(x, y, new Color(
        Math.round(red),
        Math.round(green),
        Math.round(blue),
        255,
      ));
    }
  }

  return copy;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function add(imageA: Image, imageB: Image) {
  // Composite blurred luminance with a clamped add.
  const { width, height } = imageA;
  const composite = makeImage(width, height, 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleA = imageA.getPixel(x, y);
      const sampleB = imageB.getPixel(x, y);

      const result = new Color(
        clamp(sampleB.red + sampleA.red, 0, 255),
        clamp(sampleB.green + sampleA.green, 0, 255),
        clamp(sampleB.blue + sampleA.blue, 0, 255),
        255,
      );

      composite.setPixel(x, y, result);
    }
  }

  return composite;
}

function bloom(image: Image) {
  const { width, height } = image;

  const luminanceMap = makeImage(width, height, 3, 16);
  console.log('Generating luminance.');
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const { red, green, blue } = image.getPixel(x, y);
      const luminance = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);
      // const adjustedLuminance = ((luminance / 256) ** 4) * 256

      if (luminance > 255) {
        luminanceMap.setPixel(x, y, new Color(luminance, luminance, luminance, 255));
      }
    }

    if (y % 100 === 0) {
      console.log(`\b\r${Math.round(y / height * 100)}%`);
    }
  }

  const bloom1 = blur(luminanceMap, 16, 32);
  const bloom2 = blur(luminanceMap, 8, 32);

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
        255,
      );

      compositeA.setPixel(x, y, result);
    }
  }

  // Composite blurred luminance with a clamped add.
  console.log('Generating composite.');
  const compositeB = makeImage(width, height, 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sampleA = bloom2.getPixel(x, y);
      const sampleB = compositeA.getPixel(x, y);

      const result = new Color(
        clamp(sampleB.red + sampleA.red, 0, 255),
        clamp(sampleB.green + sampleA.red, 0, 255),
        clamp(sampleB.blue + sampleA.red, 0, 255),
        255,
      );

      compositeB.setPixel(x, y, result);
    }

    if (y % 100 === 0) {
      console.log(`\b\r${Math.round(y / height * 100)}%`);
    }
  }

  return compositeB;
}

function distort(image: Image) {
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

function blur(image: Image, radius = 8, iterations = 16) {
  const blurredImage = image.clone();

  // Apply blur
  console.log('Applying blur\n');
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
        255,
      );

      blurredImage.setPixel(x, y, average);
    }

    if (y % 100 === 0) {
      console.log(`\b\r${Math.round(y / height * 100)}%`);
    }
  }

  return blurredImage;
}

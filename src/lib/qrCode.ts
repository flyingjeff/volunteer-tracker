type BlockSpec = {
  dataCodewords: number;
  blockDataCodewords: number[];
  errorCorrectionCodewords: number;
};

const alignmentCentersByVersion: number[][] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

const mediumErrorCorrectionBlocks: BlockSpec[] = [
  { dataCodewords: 16, blockDataCodewords: [16], errorCorrectionCodewords: 10 },
  { dataCodewords: 28, blockDataCodewords: [28], errorCorrectionCodewords: 16 },
  { dataCodewords: 44, blockDataCodewords: [44], errorCorrectionCodewords: 26 },
  { dataCodewords: 64, blockDataCodewords: [32, 32], errorCorrectionCodewords: 18 },
  { dataCodewords: 86, blockDataCodewords: [43, 43], errorCorrectionCodewords: 24 },
  { dataCodewords: 108, blockDataCodewords: [27, 27, 27, 27], errorCorrectionCodewords: 16 },
  { dataCodewords: 124, blockDataCodewords: [31, 31, 31, 31], errorCorrectionCodewords: 18 },
  { dataCodewords: 154, blockDataCodewords: [38, 38, 39, 39], errorCorrectionCodewords: 22 },
  { dataCodewords: 182, blockDataCodewords: [36, 36, 36, 37, 37], errorCorrectionCodewords: 22 },
  { dataCodewords: 216, blockDataCodewords: [43, 43, 43, 43, 44], errorCorrectionCodewords: 26 }
];

export function generateQrSvgDataUri(value: string, title = "QR code") {
  const matrix = generateQrMatrix(value);
  const quietZone = 4;
  const size = matrix.length + quietZone * 2;
  const cells = matrix
    .flatMap((row, y) =>
      row.map((dark, x) => (dark ? `<rect x="${x + quietZone}" y="${y + quietZone}" width="1" height="1"/>` : ""))
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img"><title>${escapeXml(
    title
  )}</title><rect width="${size}" height="${size}" fill="#fff"/><g fill="#17211c">${cells}</g></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function generateQrMatrix(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const version = chooseVersion(bytes.length);
  const spec = mediumErrorCorrectionBlocks[version - 1];
  const size = version * 4 + 17;
  const modules = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved = Array.from({ length: size }, () => Array.from({ length: size }, () => false));

  drawFunctionPatterns(modules, reserved, version);
  drawCodewords(modules, reserved, createCodewords(bytes, version, spec));
  drawFormatBits(modules, reserved, 0);
  drawVersionBits(modules, reserved, version);

  return modules;
}

function chooseVersion(byteLength: number) {
  for (let version = 1; version <= mediumErrorCorrectionBlocks.length; version += 1) {
    const countBits = version < 10 ? 8 : 16;
    const requiredBits = 4 + countBits + byteLength * 8;
    if (Math.ceil(requiredBits / 8) <= mediumErrorCorrectionBlocks[version - 1].dataCodewords) return version;
  }

  throw new Error("QR link is too long to encode.");
}

function createCodewords(bytes: number[], version: number, spec: BlockSpec) {
  const bits: number[] = [0, 1, 0, 0];
  appendBits(bits, bytes.length, version < 10 ? 8 : 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = spec.dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = bitsToCodewords(bits);
  for (let pad = 0xec; dataCodewords.length < spec.dataCodewords; pad = pad === 0xec ? 0x11 : 0xec) {
    dataCodewords.push(pad);
  }

  const blocks = spec.blockDataCodewords.map((length) => {
    const data = dataCodewords.splice(0, length);
    return { data, errorCorrection: computeErrorCorrection(data, spec.errorCorrectionCodewords) };
  });
  const result: number[] = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.data.length));

  for (let index = 0; index < maxDataLength; index += 1) {
    blocks.forEach((block) => {
      if (index < block.data.length) result.push(block.data[index]);
    });
  }

  for (let index = 0; index < spec.errorCorrectionCodewords; index += 1) {
    blocks.forEach((block) => result.push(block.errorCorrection[index]));
  }

  return result;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) bits.push((value >>> bit) & 1);
}

function bitsToCodewords(bits: number[]) {
  const codewords: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let bit = 0; bit < 8; bit += 1) value = (value << 1) | bits[index + bit];
    codewords.push(value);
  }
  return codewords;
}

function drawFunctionPatterns(modules: boolean[][], reserved: boolean[][], version: number) {
  const size = modules.length;
  drawFinder(modules, reserved, 3, 3);
  drawFinder(modules, reserved, size - 4, 3);
  drawFinder(modules, reserved, 3, size - 4);

  for (let index = 0; index < size; index += 1) {
    setFunctionModule(modules, reserved, 6, index, index % 2 === 0);
    setFunctionModule(modules, reserved, index, 6, index % 2 === 0);
  }

  alignmentCentersByVersion[version - 1].forEach((x) => {
    alignmentCentersByVersion[version - 1].forEach((y) => {
      const nearTop = y < 9;
      const nearLeft = x < 9;
      const nearRight = x > size - 10;
      if ((nearTop && nearLeft) || (nearTop && nearRight) || (nearLeft && y > size - 10)) return;
      drawAlignment(modules, reserved, x, y);
    });
  });

  setFunctionModule(modules, reserved, 8, size - 8, true);
}

function drawFinder(modules: boolean[][], reserved: boolean[][], centerX: number, centerY: number) {
  for (let y = -4; y <= 4; y += 1) {
    for (let x = -4; x <= 4; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setFunctionModule(modules, reserved, centerX + x, centerY + y, distance !== 2 && distance !== 4);
    }
  }
}

function drawAlignment(modules: boolean[][], reserved: boolean[][], centerX: number, centerY: number) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      setFunctionModule(modules, reserved, centerX + x, centerY + y, Math.max(Math.abs(x), Math.abs(y)) !== 1);
    }
  }
}

function setFunctionModule(modules: boolean[][], reserved: boolean[][], x: number, y: number, dark: boolean) {
  if (y < 0 || y >= modules.length || x < 0 || x >= modules.length) return;
  modules[y][x] = dark;
  reserved[y][x] = true;
}

function drawCodewords(modules: boolean[][], reserved: boolean[][], codewords: number[]) {
  const bits = codewords.flatMap((codeword) => {
    const result: number[] = [];
    appendBits(result, codeword, 8);
    return result;
  });
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (reserved[y][x]) continue;
        const dark = bitIndex < bits.length && bits[bitIndex] === 1;
        modules[y][x] = shouldMask(x, y) ? !dark : dark;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function shouldMask(x: number, y: number) {
  return (x + y) % 2 === 0;
}

function drawFormatBits(modules: boolean[][], reserved: boolean[][], mask: number) {
  const size = modules.length;
  const data = mask;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if (((bits >>> index) & 1) !== 0) bits ^= 0x537 << (index - 10);
  }

  bits = ((data << 10) | bits) ^ 0x5412;

  for (let index = 0; index <= 5; index += 1) setFunctionModule(modules, reserved, 8, index, getBit(bits, index));
  setFunctionModule(modules, reserved, 8, 7, getBit(bits, 6));
  setFunctionModule(modules, reserved, 8, 8, getBit(bits, 7));
  setFunctionModule(modules, reserved, 7, 8, getBit(bits, 8));
  for (let index = 9; index < 15; index += 1) setFunctionModule(modules, reserved, 14 - index, 8, getBit(bits, index));

  for (let index = 0; index < 8; index += 1) setFunctionModule(modules, reserved, size - 1 - index, 8, getBit(bits, index));
  for (let index = 8; index < 15; index += 1) setFunctionModule(modules, reserved, 8, size - 15 + index, getBit(bits, index));
}

function drawVersionBits(modules: boolean[][], reserved: boolean[][], version: number) {
  if (version < 7) return;

  const size = modules.length;
  let bits = version << 12;

  for (let index = 17; index >= 12; index -= 1) {
    if (((bits >>> index) & 1) !== 0) bits ^= 0x1f25 << (index - 12);
  }

  bits |= version << 12;

  for (let index = 0; index < 18; index += 1) {
    const x = size - 11 + (index % 3);
    const y = Math.floor(index / 3);
    setFunctionModule(modules, reserved, x, y, getBit(bits, index));
    setFunctionModule(modules, reserved, y, x, getBit(bits, index));
  }
}

function getBit(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function computeErrorCorrection(data: number[], degree: number) {
  const generator = createGenerator(degree);
  const result = Array.from({ length: degree }, () => 0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift()!;
    result.push(0);
    generator.forEach((coefficient, index) => {
      result[index] ^= multiply(coefficient, factor);
    });
  });

  return result;
}

function createGenerator(degree: number) {
  const result = Array.from({ length: degree }, () => 0);
  result[degree - 1] = 1;

  for (let index = 0, root = 1; index < degree; index += 1) {
    for (let term = 0; term < degree; term += 1) {
      result[term] = multiply(result[term], root);
      if (term + 1 < degree) result[term] ^= result[term + 1];
    }
    root = multiply(root, 0x02);
  }

  return result;
}

function multiply(left: number, right: number) {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    if (((right >>> index) & 1) !== 0) result ^= left;
  }
  return result & 0xff;
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

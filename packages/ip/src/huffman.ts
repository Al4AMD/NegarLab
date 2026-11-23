interface HuffmanNode {
  frequency: number;
  symbol: number | null;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
}

export interface HuffmanEncoded {
  bytes: Uint8Array;
  lengths: Uint8Array;
  bitLength: number;
}

export function huffmanLengths(frequencies: Uint32Array): Uint8Array {
  const lengths = new Uint8Array(frequencies.length);
  const nodes: HuffmanNode[] = [];
  for (let symbol = 0; symbol < frequencies.length; symbol += 1) {
    const frequency = frequencies[symbol] ?? 0;
    if (frequency > 0) {
      nodes.push({ frequency, symbol, left: null, right: null });
    }
  }
  if (nodes.length === 0) return lengths;
  if (nodes.length === 1) {
    lengths[nodes[0]?.symbol ?? 0] = 1;
    return lengths;
  }

  const active = nodes.slice();
  while (active.length > 1) {
    let first = 0;
    let second = 1;
    if ((active[first]?.frequency ?? 0) > (active[second]?.frequency ?? 0)) {
      first = 1;
      second = 0;
    }
    for (let i = 2; i < active.length; i += 1) {
      const frequency = active[i]?.frequency ?? 0;
      if (frequency < (active[first]?.frequency ?? 0)) {
        second = first;
        first = i;
      } else if (frequency < (active[second]?.frequency ?? 0)) {
        second = i;
      }
    }
    const left = active[first];
    const right = active[second];
    if (!left || !right) break;
    const merged: HuffmanNode = {
      frequency: left.frequency + right.frequency,
      symbol: null,
      left,
      right,
    };
    active.splice(Math.max(first, second), 1);
    active.splice(Math.min(first, second), 1);
    active.push(merged);
  }

  const walk = (node: HuffmanNode, depth: number): void => {
    if (node.symbol !== null) {
      lengths[node.symbol] = Math.max(1, depth);
      return;
    }
    if (node.left) walk(node.left, depth + 1);
    if (node.right) walk(node.right, depth + 1);
  };
  const root = active[0];
  if (root) walk(root, 0);
  return lengths;
}

export function canonicalCodes(lengths: Uint8Array): Uint32Array {
  const codes = new Uint32Array(lengths.length);
  const order = Array.from({ length: lengths.length }, (_, symbol) => symbol).filter(
    (symbol) => (lengths[symbol] ?? 0) > 0,
  );
  order.sort((a, b) => (lengths[a] ?? 0) - (lengths[b] ?? 0) || a - b);
  let code = 0;
  let previousLength = 0;
  for (const symbol of order) {
    const length = lengths[symbol] ?? 0;
    code <<= length - previousLength;
    codes[symbol] = code;
    code += 1;
    previousLength = length;
  }
  return codes;
}

export function huffmanBitLength(frequencies: Uint32Array, lengths: Uint8Array): number {
  let bits = 0;
  for (let symbol = 0; symbol < frequencies.length; symbol += 1) {
    bits += (frequencies[symbol] ?? 0) * (lengths[symbol] ?? 0);
  }
  return bits;
}

export function huffmanEncodeBytes(bytes: Uint8Array): HuffmanEncoded {
  const frequencies = new Uint32Array(256);
  for (const byte of bytes) frequencies[byte] = (frequencies[byte] ?? 0) + 1;
  const lengths = huffmanLengths(frequencies);
  const codes = canonicalCodes(lengths);
  const encoded = new Uint8Array(Math.ceil(huffmanBitLength(frequencies, lengths) / 8));
  let bitPosition = 0;
  for (const byte of bytes) {
    const code = codes[byte] ?? 0;
    const length = lengths[byte] ?? 0;
    for (let bit = length - 1; bit >= 0; bit -= 1) {
      if ((code >> bit) & 1) {
        encoded[bitPosition >> 3] = (encoded[bitPosition >> 3] ?? 0) | (0x80 >> (bitPosition & 7));
      }
      bitPosition += 1;
    }
  }
  return { bytes: encoded, lengths, bitLength: bitPosition };
}

export function huffmanDecodeBytes(
  encoded: Uint8Array,
  lengths: Uint8Array,
  symbolCount: number,
): Uint8Array {
  const codes = canonicalCodes(lengths);
  const lookup = new Map<number, number>();
  let maximumLength = 0;
  for (let symbol = 0; symbol < lengths.length; symbol += 1) {
    const length = lengths[symbol] ?? 0;
    if (length === 0) continue;
    maximumLength = Math.max(maximumLength, length);
    lookup.set((length << 16) | (codes[symbol] ?? 0), symbol);
  }
  const out = new Uint8Array(symbolCount);
  let code = 0;
  let length = 0;
  let written = 0;
  for (let bit = 0; bit < encoded.length * 8 && written < symbolCount; bit += 1) {
    const byte = encoded[bit >> 3] ?? 0;
    code = (code << 1) | ((byte >> (7 - (bit & 7))) & 1);
    length += 1;
    const symbol = lookup.get((length << 16) | code);
    if (symbol !== undefined) {
      out[written] = symbol;
      written += 1;
      code = 0;
      length = 0;
    } else if (length > maximumLength) {
      throw new Error("invalid huffman stream");
    }
  }
  if (written !== symbolCount) throw new Error("truncated huffman stream");
  return out;
}

/** Bounded base64 decoding; MIME labels alone do not establish file type. */
export function decodeCover(value: string | null): { bytes: Buffer; mime: string } | null {
  if (!value || value.length > 7_000_000) return null
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) return null
  const bytes = Buffer.from(match[2], 'base64')
  if (!bytes.length || bytes.length > 5 * 1024 * 1024 || bytes.toString('base64') !== match[2]) return null
  const valid = match[1] === 'png'
    ? bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && bytes.toString('ascii', 12, 16) === 'IHDR'
    : match[1] === 'jpeg'
      ? bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217
      : bytes.length >= 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length
  return valid ? { bytes, mime: `image/${match[1]}` } : null
}

export function chapterSlugFilter(slug: string) {
  const match = /^chuong-([1-9]\d*)$/.exec(slug)
  if (match && Number.isSafeInteger(Number(match[1]))) {
    return { order: Number(match[1]) }
  }
  return { slug }
}

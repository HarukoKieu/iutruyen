/**
 * Automatically crops and resizes any image to the exact 2:3 golden ratio for book covers.
 * Returns a base64 DataURL (image/jpeg) ready for upload/storage.
 */
export async function cropAndResizeCoverImage(
  file: File,
  targetWidth: number = 600,
  targetHeight: number = 900
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Tệp hình ảnh không hợp lệ'))
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context không khả dụng'))
          return
        }

        // Enable high quality image smoothing
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'

        const srcWidth = img.naturalWidth || img.width
        const srcHeight = img.naturalHeight || img.height

        const targetAspect = targetWidth / targetHeight // 2/3 = 0.6666...
        const srcAspect = srcWidth / srcHeight

        let sx = 0
        let sy = 0
        let sWidth = srcWidth
        let sHeight = srcHeight

        if (srcAspect > targetAspect) {
          // Source is wider than 2:3 -> crop left/right edges
          sWidth = srcHeight * targetAspect
          sx = (srcWidth - sWidth) / 2
        } else {
          // Source is taller than 2:3 -> crop top/bottom edges
          sHeight = srcWidth / targetAspect
          sy = (srcHeight - sHeight) / 2
        }

        // Draw cropped and scaled image into canvas
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight)

        // Export as JPEG with optimal 0.88 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
        resolve(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

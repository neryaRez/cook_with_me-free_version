const AVATAR_SIZE = 256
const AVATAR_QUALITY = 0.82

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read the selected image.'))
    }

    image.src = objectUrl
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Could not optimize the selected image.'))
        }
      },
      type,
      quality
    )
  })
}

export async function optimizeAvatarImage(file) {
  const image = await loadImage(file)

  const sourceWidth = image.naturalWidth
  const sourceHeight = image.naturalHeight
  const cropSize = Math.min(sourceWidth, sourceHeight)
  const sourceX = Math.floor((sourceWidth - cropSize) / 2)
  const sourceY = Math.floor((sourceHeight - cropSize) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Image processing is not supported in this browser.')
  }

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    sourceX,
    sourceY,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  )

  const blob = await canvasToBlob(canvas, 'image/webp', AVATAR_QUALITY)

  return new File([blob], 'avatar.webp', {
    type: 'image/webp',
    lastModified: Date.now(),
  })
}

/**
 * Reduz a foto no próprio navegador antes do upload (lado maior até `max` px, WebP).
 * Fotos de celular com 4–8 MB viram ~100 KB, o que deixa o cardápio leve nos tablets.
 */
export async function compressImage(file: File, max = 800, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("canvas indisponível")
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("falha ao converter"))), "image/webp", quality)
  )
}

/** 24.9 → "24,90" para campos de valor */
export function toMoneyInput(value: number | null | undefined) {
  return value == null ? "" : value.toFixed(2).replace(".", ",")
}

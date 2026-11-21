/** Foto dikecilkan di browser sebelum diunggah agar tetap di bawah batas PHP lokal (bawaan 2 MB). */
export const IMAGE_UPLOAD_TARGET_BYTES = 1_800_000;
export const IMAGE_UPLOAD_MAX_SIDE = 2000;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadElement(file));
  }
  return loadElement(file);
}

function loadElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Foto tidak dapat dibaca di browser. Pilih file JPG, PNG, atau WebP.")); };
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Foto gagal diperkecil di browser. Coba file lain.")),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Mengembalikan file asli bila sudah kecil, atau JPEG baru dengan sisi terpanjang ≤ 2.000 px
 * dan ukuran di bawah `targetBytes`. Rasio foto dipertahankan; latar transparan menjadi putih.
 */
export async function prepareImageForUpload(file: File, targetBytes = IMAGE_UPLOAD_TARGET_BYTES): Promise<File> {
  // Format lain (mis. GIF/HEIC) dibiarkan agar server memberi pesan format yang jelas.
  if (!ACCEPTED.includes(file.type)) return file;
  const source = await decode(file);
  const largest = Math.max(source.width, source.height);
  if (file.size <= targetBytes && largest <= IMAGE_UPLOAD_MAX_SIDE) {
    if ("close" in source) source.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    if ("close" in source) source.close();
    return file;
  }

  let maxSide = IMAGE_UPLOAD_MAX_SIDE;
  let quality = 0.85;
  let blob: Blob | null = null;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, maxSide / largest);
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      blob = await encode(canvas, quality);
      if (blob.size <= targetBytes) break;
      if (quality > 0.6) quality -= 0.1;
      else maxSide = Math.max(800, Math.round(maxSide * 0.8));
    }
  } finally {
    if ("close" in source) source.close();
  }

  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, "").trim() || "foto";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

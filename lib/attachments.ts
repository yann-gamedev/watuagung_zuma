// File hanya di memori; nama asli tidak diteruskan ke server.
export async function prepareAttachment(file: File): Promise<File> {
  if (file.type === "application/pdf") {
    if (file.size > 5 * 1024 * 1024) throw new Error("PDF terlalu besar. Maksimal 5 MB per dokumen. Pilih PDF yang lebih kecil.");
    if (await file.slice(0, 5).text() !== "%PDF-") throw new Error("PDF tidak dapat dibaca. Pilih berkas PDF yang valid.");
    return new File([file], "dokumen.pdf", { type: "application/pdf" });
  }
  if (!file.type.startsWith("image/")) throw new Error("Pilih gambar atau PDF. Foto akan diubah menjadi JPG.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Foto tidak dapat dibaca. Pilih foto JPG, PNG, atau WebP, atau ambil foto lagi."));
      image.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    if (Math.min(canvas.width, canvas.height) < 600) throw new Error("Foto terlalu kecil untuk dibaca. Ambil foto lebih dekat; sisi pendek minimal 600 piksel.");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser tidak dapat memproses foto. Coba browser lain atau pilih PDF.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("Foto gagal diproses. Ambil foto lagi atau pilih PDF.")), "image/jpeg", 0.85,
    ));
    // Kualitas/dimensi tetap; jangan kirim foto besar diam-diam pada koneksi HP.
    if (blob.size >= 1_500_000) throw new Error("Foto masih terlalu besar setelah diperkecil (maksimal di bawah 1,5 MB). Ambil ulang dengan latar polos atau pilih PDF maksimal 5 MB.");
    return new File([blob], "foto.jpg", { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

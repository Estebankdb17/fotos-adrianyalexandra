
/**
 * Load image as HTMLImageElement from File (data URL)
 */
function loadImageFromFile(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Draw image to canvas without rotation — browser handles EXIF orientation automatically.
 * Only resize while preserving aspect ratio.
 */
function drawImageToCanvas(img, targetWidth, targetHeight){
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return canvas;
}

/**
 * Resize image file in browser to maxWidth (preserve aspect ratio).
 * Let browser decode EXIF orientation naturally.
 * Export as JPEG. Returns a Promise<Blob>.
 */
export async function resizeImageFile(file, maxWidth = 2048, quality = 0.85){
  const img = await loadImageFromFile(file);
  // Compute scaled dimensions preserving aspect ratio
  let iw = img.naturalWidth, ih = img.naturalHeight;
  let targetWidth = iw, targetHeight = ih;
  if(iw > maxWidth){
    targetWidth = maxWidth;
    targetHeight = Math.round(maxWidth * ih / iw);
  }

  const canvas = drawImageToCanvas(img, targetWidth, targetHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if(blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, 'image/jpeg', quality);
  });
}

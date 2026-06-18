export function humanFileSize(bytes, si=false, dp=1){
  const thresh = si ? 1000 : 1024;
  if(Math.abs(bytes) < thresh) return bytes + ' B';
  const units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
  let u = -1; do { bytes /= thresh; ++u; } while(Math.abs(bytes) >= thresh && u < units.length - 1);
  return bytes.toFixed(dp) + ' ' + units[u];
}

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
  console.log('resizeImageFile - original file:', file.name);
  
  const img = await loadImageFromFile(file);
  console.log('resizeImageFile - natural dimensions:', img.naturalWidth, 'x', img.naturalHeight);
  
  // Compute scaled dimensions preserving aspect ratio
  let iw = img.naturalWidth, ih = img.naturalHeight;
  let targetWidth = iw, targetHeight = ih;
  if(iw > maxWidth){
    targetWidth = maxWidth;
    targetHeight = Math.round(maxWidth * ih / iw);
  }

  console.log('resizeImageFile - target canvas dimensions:', targetWidth, 'x', targetHeight);

  const canvas = drawImageToCanvas(img, targetWidth, targetHeight);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if(blob) resolve(blob);
      else reject(new Error('Canvas export failed'));
    }, 'image/jpeg', quality);
  });
}

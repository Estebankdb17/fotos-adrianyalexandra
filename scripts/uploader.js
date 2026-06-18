import { resizeImageFile } from './utils.js';
import { COMPLETE_UPLOAD_URL, CREATE_UPLOAD_URL, EVENT_SLUG } from './config.js';

/**
 * setupUploader(options)
 * options: { formSelector, fileInputSelector, dropzoneSelector, feedbackSelector, createUploadUrl, completeUploadUrl, eventSlug, onUploadComplete }
 * createUploadUrl: Supabase Edge Function URL that returns a presigned R2 PUT URL.
 */
export function setupUploader(options = {}){
  const uploadConfig = {
    createUploadUrl: options.createUploadUrl || CREATE_UPLOAD_URL,
    completeUploadUrl: options.completeUploadUrl || COMPLETE_UPLOAD_URL,
    eventSlug: options.eventSlug || EVENT_SLUG,
  };
  const fileInput = document.querySelector(options.fileInputSelector);
  const dropzone = options.dropzoneSelector ? document.querySelector(options.dropzoneSelector) : null;
  const feedback = document.querySelector(options.feedbackSelector);
  const queueEl = document.getElementById('upload-queue');

  console.log('Uploader initialized. CREATE_UPLOAD_URL:', uploadConfig.createUploadUrl);

  // concurrent upload limit
  const CONCURRENT = 3;
  let active = 0;
  const pending = [];
  let uiPhotoCounter = 0; // display counter for guest-friendly labels
  // Keep a session record of uploaded or queued file signatures to prevent duplicates
  const seenSignatures = new Set();

  function showMessage(msg){
    if(feedback) feedback.textContent = msg;
  }

  if(dropzone){
    dropzone.addEventListener('click', ()=> fileInput.click());
  }

  fileInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files || []);
    console.log('Upload - selected files count:', files.length, 'createUploadUrl:', uploadConfig.createUploadUrl);
    if(files.length === 0) return;

    const validFiles = [];
    let unsupportedFile = false;
    let oversizedImage = false;
    let oversizedVideo = false;

    files.forEach(file => {
      console.log('Upload - selected file:', file.name, file.size, file.type, file.lastModified);
      const validation = validateFile(file);
      if(validation.error === 'unsupported'){
        unsupportedFile = true;
        return;
      }
      if(validation.error === 'image-too-large'){
        oversizedImage = true;
        return;
      }
      if(validation.error === 'video-too-large'){
        oversizedVideo = true;
        return;
      }
      validFiles.push(file);
    });

    if(oversizedImage){
      showMessage('Esta fotografía es demasiado grande para compartirse desde aquí.');
    } else if(oversizedVideo){
      showMessage('Este vídeo es demasiado grande para compartirse desde aquí.');
    } else if(unsupportedFile){
      showMessage('Este archivo no puede compartirse desde aquí.');
    }

    if(validFiles.length === 0){
      fileInput.value = '';
      return;
    }

    validFiles.forEach(f => enqueueFile(f));
    fileInput.value = '';
    showMessage(`Compartiendo ${validFiles.length} ${validFiles.length === 1 ? 'archivo' : 'archivos'}… Gracias por contribuir a nuestros recuerdos.`);
    // Scroll to the upload queue so guests immediately see progress (mobile-friendly)
    if(queueEl && typeof queueEl.scrollIntoView === 'function'){
      // Allow a short tick for the queue DOM to render
      setTimeout(()=>{
        try{ queueEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }catch(e){ console.warn('scrollIntoView failed', e); }
      }, 50);
    }
    processQueue();
  });

  function getFileExtension(file){
    return file.name.toLowerCase().split('.').pop() || '';
  }

  function getMediaType(file){
    const mimeType = getMimeType(file);
    const ext = getFileExtension(file);
    const imageTypes = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
    const imageExtensions = ['jpg','jpeg','png','webp','heic','heif'];
    const videoTypes = ['video/mp4','video/quicktime'];
    const videoExtensions = ['mp4','mov'];

    if(imageTypes.includes(mimeType) || imageExtensions.includes(ext)) return 'image';
    if(videoTypes.includes(mimeType) || videoExtensions.includes(ext)) return 'video';
    return null;
  }

  function validateFile(file){
    const mediaType = getMediaType(file);
    const maxImageSize = 25 * 1024 * 1024;
    const maxVideoSize = 300 * 1024 * 1024;

    if(mediaType === 'image'){
      return file.size > maxImageSize ? { error: 'image-too-large' } : { mediaType };
    }

    if(mediaType === 'video'){
      return file.size > maxVideoSize ? { error: 'video-too-large' } : { mediaType };
    }

    return { error: 'unsupported' };
  }

  function getMimeType(file){
    if(file.type) return file.type.toLowerCase();
    const ext = getFileExtension(file);
    const mimeTypes = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
      mp4: 'video/mp4',
      mov: 'video/quicktime'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  function enqueueFile(file){
    const validation = validateFile(file);
    if(validation.error === 'unsupported'){
      showMessage('Este archivo no puede compartirse desde aquí.');
      return;
    }
    if(validation.error === 'image-too-large'){
      showMessage('Esta fotografía es demasiado grande para compartirse desde aquí.');
      return;
    }
    if(validation.error === 'video-too-large'){
      showMessage('Este vídeo es demasiado grande para compartirse desde aquí.');
      return;
    }
    const sig = `${file.name}|${file.size}|${file.lastModified}`;
    if(seenSignatures.has(sig)){
      // Warm, guest-friendly warning — do not block the user
      showMessage('Parece que ya agregaste esta foto; la omitimos para evitar duplicados. ¡Gracias!');
      return;
    }
    const item = { file, id: Date.now() + Math.random().toString(36).slice(2), progress: 0, sig, displayName: `Foto ${++uiPhotoCounter}` };
    pending.push(item);
    seenSignatures.add(sig);
    renderQueue();
  }

  function renderQueue(){
    if(!queueEl) return;
    queueEl.innerHTML = '';
    pending.forEach(item => {
      const el = document.createElement('div'); el.className = 'queue-item'; el.dataset.id = item.id;

      const thumb = document.createElement('div'); thumb.className = 'queue-thumb';
      const img = document.createElement('img'); img.alt = item.displayName;
      // Generate an oriented thumbnail asynchronously to ensure correct orientation on iPhone
      img.src = '';
      thumb.appendChild(img);
      // create thumbnail (non-blocking)
      resizeImageFile(item.file, 800, 0.7).then(blob => {
        try{ img.src = URL.createObjectURL(blob); }catch(e){}
      }).catch(()=>{
        // fallback to object URL of original
        img.src = URL.createObjectURL(item.file);
      });

      const info = document.createElement('div'); info.className = 'queue-info';
      const name = document.createElement('div'); name.className = 'queue-name'; name.textContent = item.displayName;
      const progressWrap = document.createElement('div'); progressWrap.className = 'progress';
      const bar = document.createElement('div'); bar.className = 'progress-bar'; bar.style.width = (item.progress||0) + '%';
      progressWrap.appendChild(bar);

      info.appendChild(name); info.appendChild(progressWrap);

      const status = document.createElement('div'); status.className = 'queue-status'; status.textContent = 'En cola';

      el.appendChild(thumb); el.appendChild(info); el.appendChild(status);
      queueEl.appendChild(el);
    });
  }

  async function processQueue(){
    while(pending.length && active < CONCURRENT){
      const item = pending.shift();
      active++;
      updateQueueStatus(item.id, 'Enviando…');
      try{
        // Upload original file directly to R2 through a Supabase-generated presigned URL.
        console.log('Upload - sending original file to R2:', item.file.name, 'size:', item.file.size, 'type:', item.file.type);
        const result = await uploadFileWithProgress(item.file, uploadConfig.createUploadUrl, uploadConfig.completeUploadUrl, uploadConfig.eventSlug, (p)=> updateQueueProgress(item.id, p));
        updateQueueStatus(item.id, 'Compartido');
        // Mark signature as uploaded (already added to seenSignatures when queued)
        if(item.sig) seenSignatures.add(item.sig);
        if(options.onUploadComplete) options.onUploadComplete(result);
      }catch(err){
        console.error(err);
        updateQueueStatus(item.id, 'Error');
        showMessage(err.message || 'No hemos podido subir esta foto. Intenta nuevamente.');
        if(options.onUploadError) options.onUploadError(err);
      }finally{
        active--;
        renderQueue();
        // continue processing if more pending
        if(pending.length) processQueue();
        // If queue is empty and no active uploads, show warm confirmation
        if(pending.length === 0 && active === 0){
          showMessage('Gracias — tus recuerdos ya están compartidos. ❤️');
        }
      }
    }
  }

  function updateQueueProgress(id, percent){
    const el = queueEl && queueEl.querySelector(`.queue-item[data-id="${id}"]`);
    if(!el) return;
    const bar = el.querySelector('.progress-bar'); if(bar) bar.style.width = percent + '%';
    const status = el.querySelector('.queue-status'); if(status) status.textContent = percent >= 100 ? 'Procesando…' : `${Math.round(percent)}%`;
  }

  function updateQueueStatus(id, text){
    const el = queueEl && queueEl.querySelector(`.queue-item[data-id="${id}"]`);
    if(!el) return;
    const status = el.querySelector('.queue-status'); if(status) status.textContent = text;
  }

  // Upload with progress reporting through Supabase Edge Functions and R2.
  async function uploadFileWithProgress(file, createUploadUrl, completeUploadUrl, eventSlug, onProgress){
    if(!createUploadUrl){
      throw new Error('Falta configurar la URL de subida.');
    }

    if(!eventSlug){
      throw new Error('Falta configurar el evento para subir esta foto.');
    }

    if(!completeUploadUrl){
      throw new Error('Falta configurar la confirmacion de subida.');
    }

    const mimeType = getMimeType(file);
    const presignResponse = await fetch(createUploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventSlug,
        filename: file.name,
        mimeType,
        sizeBytes: file.size
      })
    });

    let presignJson = null;
    try{
      presignJson = await presignResponse.json();
    }catch(e){
      throw new Error('No hemos podido preparar la subida. Intenta nuevamente.');
    }

    console.log('Upload - create-upload-url response:', presignJson);

    if(!presignResponse.ok || !presignJson.success || !presignJson.data || !presignJson.data.uploadUrl){
      throw new Error(presignJson.error || 'No hemos podido preparar la subida. Intenta nuevamente.');
    }

    const uploadData = presignJson.data;
    await putFileToR2(uploadData.uploadUrl, file, mimeType, onProgress);
    console.log('Upload - R2 upload success:', { storageKey: uploadData.storageKey });

    const completeJson = await completeUpload(completeUploadUrl, {
      eventSlug,
      storageKey: uploadData.storageKey,
      originalFilename: file.name,
      mimeType,
      mediaType: uploadData.mediaType,
      sizeBytes: file.size,
      publicUrl: uploadData.publicUrl || '',
    });
    return {
      id: completeJson.data.id,
      src: completeJson.data.public_url || uploadData.publicUrl || '',
      alt: file.name,
      caption: '',
      storageKey: completeJson.data.storage_key,
      eventId: completeJson.data.event_id,
      mediaType: completeJson.data.media_type
    };
  }

  function putFileToR2(uploadUrl, file, mimeType, onProgress){
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', mimeType);

      xhr.upload.onprogress = (event) => {
        if(event.lengthComputable){
          onProgress && onProgress(Math.min(99, (event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        if(xhr.status >= 200 && xhr.status < 300){
          onProgress && onProgress(100);
          resolve();
          return;
        }
        reject(new Error('No hemos podido subir esta foto. Intenta nuevamente.'));
      };

      xhr.onerror = () => reject(new Error('Error de red al subir la foto.'));
      xhr.onabort = () => reject(new Error('Subida cancelada.'));
      xhr.send(file);
    });
  }

  async function completeUpload(completeUploadUrl, metadata){
    const response = await fetch(completeUploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    let json = null;
    try{
      json = await response.json();
    }catch(e){
      throw new Error('No hemos podido confirmar la subida. Intenta nuevamente.');
    }

    console.log('Upload - complete-upload response:', json);

    if(!response.ok || !json.success || !json.data){
      throw new Error(json.error || 'No hemos podido confirmar la subida. Intenta nuevamente.');
    }

    return json;
  }
}

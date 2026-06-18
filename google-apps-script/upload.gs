const UPLOAD_FOLDER_ID = '1lbl6yZw3-XVLd19dBqEa55_Wio4Y1O3C';
const PUBLIC_IMAGE_BASE = 'https://drive.google.com/uc?export=view&id=';

function doPost(e) {
  try {
    console.log('doPost start');
    if (!e) {
      console.error('doPost - no event object');
      return jsonError('No se recibió ninguna imagen.');
    }

    console.log('doPost - postData.type:', e.postData && e.postData.type);

    const uploadData = parseUploadPayload(e);
    if (!uploadData || !uploadData.blob) {
      console.error('doPost - no valid uploadData returned from parseUploadPayload');
      return jsonError('No se recibió ninguna imagen válida.');
    }

    // Log metadata if available
    if (uploadData.source === 'json') {
      console.log('doPost - JSON payload detected');
      console.log('doPost - filename:', uploadData.filename, 'mimeType:', uploadData.mimeType, 'decodedBytes:', uploadData.decodedLength);
    } else if (uploadData.source === 'form') {
      console.log('doPost - multipart/form-data payload detected');
      try { console.log('doPost - form filename:', uploadData.filename, 'mimeType:', uploadData.mimeType); } catch(e){}
    }

    const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
    const file = folder.createFile(uploadData.blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    console.log('doPost - saved file id:', file.getId());

    return jsonSuccess(buildPhotoResponse(file));
  } catch (err) {
    console.error('doPost - error', err && err.stack ? err.stack : err);
    return jsonError((err && err.message) ? err.message : 'Error inesperado.');
  }
}

function parseUploadPayload(e) {
  if (e.files && e.files.file) {
    const imageBlob = e.files.file;
    const contentType = imageBlob.getContentType();
    if (!isAllowedImageType(contentType)) {
      throw new Error('Solo se aceptan imágenes JPG, PNG, WEBP, HEIC o HEIF.');
    }
    return { blob: imageBlob, source: 'form', filename: imageBlob.getName(), mimeType: contentType, decodedLength: imageBlob.getBytes().length };
  }

  if (e.postData && e.postData.contents) {
    // Accept JSON payload regardless of Content-Type (e.g., text/plain;charset=utf-8)
    try {
      const payload = JSON.parse(e.postData.contents);
      if (!payload.filename || !payload.mimeType || !payload.contents) {
        throw new Error('El cuerpo JSON debe incluir filename, mimeType y contents.');
      }
      if (!isAllowedImageType(payload.mimeType)) {
        throw new Error('Solo se aceptan imágenes JPG, PNG, WEBP, HEIC o HEIF.');
      }
      const decoded = Utilities.base64Decode(payload.contents);
      const blob = Utilities.newBlob(decoded, payload.mimeType, payload.filename);
      return { blob: blob, source: 'json', filename: payload.filename, mimeType: payload.mimeType, decodedLength: decoded.length };
    } catch (parseErr) {
      throw new Error('No se pudo parsear el cuerpo JSON: ' + (parseErr && parseErr.message));
    }
  }

  return null;
}

function doGet(e) {
  const action = e.parameter && e.parameter.action;
  if (action === 'gallery') {
    const callback = e.parameter && e.parameter.callback;
    const resp = galleryResponse();
    // If callback provided, return JSONP
    if (callback) {
      try {
        // Build data object
        const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
        const files = folder.getFiles();
        const photos = [];
        while (files.hasNext()) {
          const file = files.next();
          if (!isAllowedImageType(file.getMimeType())) continue;
          photos.push(buildPhotoResponse(file));
        }
        photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const payload = JSON.stringify({ success: true, data: { photos } });
        const body = callback + '(' + payload + ');';
        return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
      } catch (err) {
        const payload = JSON.stringify({ success: false, error: err.message || 'Error inesperado.' });
        const body = callback + '(' + payload + ');';
        return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }
    return resp;
  }
  return jsonSuccess({ status: 'ready' });
}

function galleryResponse() {
  try {
    const folder = DriveApp.getFolderById(UPLOAD_FOLDER_ID);
    const files = folder.getFiles();
    const photos = [];

    while (files.hasNext()) {
      const file = files.next();
      if (!isAllowedImageType(file.getMimeType())) {
        continue;
      }
      photos.push(buildPhotoResponse(file));
    }

    photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return jsonSuccess({ photos });
  } catch (err) {
    return jsonError(err.message || 'Error inesperado.');
  }
}

function buildPhotoResponse(file) {
  const thumbnail2000 = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w2000';
  const thumbnail3000 = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w3000';
  return {
    id: file.getId(),
    src: thumbnail2000,
    fullSrc: thumbnail3000,
    alt: file.getName(),
    caption: '',
    createdAt: file.getDateCreated().toISOString()
  };
}

function isAllowedImageType(type) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  return allowed.includes(type.toLowerCase());
}

function jsonSuccess(data) {
  return ContentService.createTextOutput(JSON.stringify({ success: true, data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

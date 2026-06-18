import { renderGallery, appendPhotos } from './gallery.js';
import { setupUploader } from './uploader.js';
import { attachLightbox } from './lightbox.js';

// Supabase Edge Function used for direct browser-to-R2 uploads.
export const EVENT_SLUG = 'adrian-alexandra';
export const CREATE_UPLOAD_URL = 'https://omwwwnoewfajiepgijcy.functions.supabase.co/create-upload-url';
export const COMPLETE_UPLOAD_URL = 'https://omwwwnoewfajiepgijcy.functions.supabase.co/complete-upload';

// Apps Script upload endpoint kept for rollback:
// export const APPS_SCRIPT_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbx2Ja8nOx5h6HH7ipT4mzFIKXrDFfCEnZWqFkbybz-Uv2BMed-m6ZvFVgGKg_ahmc_9FQ/exec';

// Gallery loading intentionally remains on the existing Apps Script flow for now.
export const GALLERY_API_URL = 'https://script.google.com/macros/s/AKfycbx2Ja8nOx5h6HH7ipT4mzFIKXrDFfCEnZWqFkbybz-Uv2BMed-m6ZvFVgGKg_ahmc_9FQ/exec?action=gallery';

document.addEventListener('DOMContentLoaded', async () => {
  const photosEl = document.getElementById('photos');

  renderGallery(photosEl, []);

  // Setup uploader with hooks
  setupUploader({
    formSelector: '#upload-form',
    fileInputSelector: '#file-input',
    feedbackSelector: '#upload-feedback',
    createUploadUrl: CREATE_UPLOAD_URL,
    completeUploadUrl: COMPLETE_UPLOAD_URL,
    eventSlug: EVENT_SLUG,
    onUploadComplete: (photo) => {
      // After a successful upload, refresh the gallery from the server after short delay
      setTimeout(() => fetchGallery(), 1200);
    }
  });

  // The upload feedback area remains empty until needed for progress or errors
  const feedback = document.getElementById('upload-feedback');
  if(feedback) feedback.textContent = '';

  // Wire hero upload CTA to open the file picker for quick access
  const heroBtn = document.getElementById('hero-upload');
  const fileInput = document.getElementById('file-input');
  if(heroBtn && fileInput){
    heroBtn.addEventListener('click', ()=> fileInput.click());
  }
  // Load real gallery from the deployed Apps Script
  function fetchGallery(){
    if(!GALLERY_API_URL) return;
    // Use JSONP to avoid CORS issues with Apps Script
    const callbackName = 'gallery_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    window[callbackName] = function(json){
      try{
        let photos = [];
        if(json && json.success){
          if(json.data && Array.isArray(json.data.photos)) photos = json.data.photos;
          else if(Array.isArray(json.data)) photos = json.data;
        }
        // Update gallery counter
        const counterEl = document.getElementById('gallery-counter');
        const count = photos.length || 0;
        if(counterEl){
          counterEl.hidden = count === 0;
          counterEl.textContent = `❤️ ${count} recuerdos compartidos`;
        }
        if(photos.length) {
          renderGallery(photosEl, photos);
          attachLightbox(photosEl, photos);
        } else {
          renderGallery(photosEl, []);
        }
      }catch(err){
        console.error('Gallery JSONP handler error', err);
        renderGallery(photosEl, []);
      } finally {
        try{ delete window[callbackName]; }catch(e){}
        const s = document.getElementById(callbackName);
        if(s && s.parentNode) s.parentNode.removeChild(s);
      }
    };
    const script = document.createElement('script');
    script.id = callbackName;
    script.src = GALLERY_API_URL + '&callback=' + callbackName;
    script.onerror = function(){
      console.error('Gallery JSONP script error');
      try{ delete window[callbackName]; }catch(e){}
      if(script && script.parentNode) script.parentNode.removeChild(script);
      renderGallery(photosEl, []);
    };
    document.body.appendChild(script);
    // Safety timeout
    setTimeout(()=>{
      if(window[callbackName]){
        try{ delete window[callbackName]; }catch(e){}
        if(script && script.parentNode) script.parentNode.removeChild(script);
        renderGallery(photosEl, []);
      }
    }, 8000);
  }

  // Initial load
  fetchGallery();
});

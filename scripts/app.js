import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderGallery } from './gallery.js';
import { setupUploader } from './uploader.js';
import { attachLightbox } from './lightbox.js';

// Supabase project configuration.
export const SUPABASE_URL = 'https://omwwwnoewfajiepgijcy.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_FA-KAPRgyQkBoczJu7RTRg_5V-IyqnU';
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Supabase Edge Functions used for direct browser-to-R2 uploads.
export const EVENT_SLUG = 'adrian-alexandra';
export const CREATE_UPLOAD_URL = 'https://omwwwnoewfajiepgijcy.functions.supabase.co/create-upload-url';
export const COMPLETE_UPLOAD_URL = 'https://omwwwnoewfajiepgijcy.functions.supabase.co/complete-upload';

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
    onUploadComplete: () => {
      // After complete-upload inserts metadata, refresh from Supabase.
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

  function mapMediaRow(row){
    const isVideo = row.media_type === 'video';
    return {
      id: row.id,
      src: row.public_url,
      fullSrc: row.public_url,
      alt: row.original_filename || (isVideo ? 'Vídeo compartido' : 'Recuerdo compartido'),
      caption: '',
      type: isVideo ? 'video' : 'image'
    };
  }

  function updateGalleryCounter(count){
    const counterEl = document.getElementById('gallery-counter');
    if(counterEl){
      counterEl.hidden = count === 0;
      counterEl.textContent = `❤️ ${count} recuerdos compartidos`;
    }
  }

  async function fetchGallery(){
    const { data, error } = await supabase
      .from('media')
      .select('id, storage_key, original_filename, mime_type, media_type, size_bytes, public_url, created_at')
      .order('created_at', { ascending: false });

    if(error){
      console.error('Supabase gallery load error', error);
      renderGallery(photosEl, []);
      updateGalleryCounter(0);
      return;
    }

    const photos = (data || [])
      .filter(row => row.public_url)
      .map(mapMediaRow);

    updateGalleryCounter(photos.length);
    renderGallery(photosEl, photos);
    if(photos.length) attachLightbox(photosEl, photos);
  }

  // Initial load
  fetchGallery();
});

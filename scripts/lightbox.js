const SWIPE_THRESHOLD = 30;

let lightboxState = {
  photos: [],
  index: 0,
  isOpen: false,
  startX: 0,
  startY: 0,
  scale: 1,
  lastScale: 1,
  triggerEl: null,
};

const lightboxEl = document.createElement('div');
lightboxEl.id = 'photo-lightbox';
lightboxEl.setAttribute('role', 'dialog');
lightboxEl.setAttribute('aria-modal', 'true');
lightboxEl.setAttribute('aria-label', 'Vista ampliada del recuerdo');
lightboxEl.setAttribute('tabindex', '-1');
lightboxEl.innerHTML = `
  <div class="lightbox-content">
    <div class="lightbox-topbar">
      <div class="lightbox-counter" aria-live="polite">1 / 1</div>
    </div>
    <div class="lightbox-image-wrapper">
      <button class="lightbox-close" aria-label="Cerrar">×</button>
      <img id="lightbox-image" src="" alt="" />
      <video id="lightbox-video" controls playsinline hidden></video>
      <div class="lightbox-nav">
        <button id="lightbox-prev" aria-label="Foto anterior">‹</button>
        <button id="lightbox-next" aria-label="Foto siguiente">›</button>
      </div>
    </div>
    <div class="lightbox-meta">
      <div class="lightbox-caption"></div>
      <div class="lightbox-actions">
        <a id="lightbox-download" class="lightbox-button" target="_blank" rel="noopener">Ver original</a>
      </div>
    </div>
  </div>
`;
document.body.appendChild(lightboxEl);

const imgEl = lightboxEl.querySelector('#lightbox-image');
const videoEl = lightboxEl.querySelector('#lightbox-video');
const captionEl = lightboxEl.querySelector('.lightbox-caption');
const counterEl = lightboxEl.querySelector('.lightbox-counter');
const downloadEl = lightboxEl.querySelector('#lightbox-download');
const closeEl = lightboxEl.querySelector('.lightbox-close');
const prevEl = lightboxEl.querySelector('#lightbox-prev');
const nextEl = lightboxEl.querySelector('#lightbox-next');

function setMediaTransform(value){
  imgEl.style.transform = value;
  videoEl.style.transform = value;
}

function updateNavVisibility(photos){
  const hasMultipleItems = photos.length > 1;
  prevEl.hidden = !hasMultipleItems;
  nextEl.hidden = !hasMultipleItems;
  lightboxEl.classList.toggle('single-item', !hasMultipleItems);
}

function setPhoto(photos, index){
  const photo = photos[index];
  if(!photo) return;
  lightboxState.photos = photos;
  lightboxState.index = index;
  updateNavVisibility(photos);
  if(counterEl) counterEl.textContent = `${index + 1} / ${photos.length}`;
  lightboxState.scale = 1;
  lightboxState.lastScale = 1;
  setMediaTransform('scale(1)');
  const displaySrc = photo.src || photo.fullSrc || '';
  console.log('Lightbox photo:', photo);
  console.log('Lightbox display src:', displaySrc);

  if(photo.type === 'video'){
    imgEl.hidden = true;
    imgEl.removeAttribute('src');
    videoEl.hidden = false;
    videoEl.src = displaySrc;
    videoEl.setAttribute('aria-label', photo.alt || 'Vídeo compartido');
  } else {
    videoEl.hidden = true;
    videoEl.pause();
    videoEl.removeAttribute('src');
    imgEl.hidden = false;
    imgEl.src = displaySrc;
    imgEl.alt = photo.alt || 'Imagen de la boda';
  }

  captionEl.textContent = photo.caption || '';
  downloadEl.href = photo.fullSrc || photo.src || '';
  downloadEl.setAttribute('download', `recuerdo-${index + 1}`);
}

function openLightbox(photos, index, triggerEl){
  lightboxState.photos = photos;
  lightboxState.triggerEl = triggerEl || document.activeElement;
  lightboxState.bodyOverflow = document.body.style.overflow;
  lightboxEl.classList.add('open');
  document.body.style.overflow = 'hidden';
  lightboxState.isOpen = true;
  setPhoto(photos, index);
  closeEl.focus({ preventScroll: true });
}

function closeLightbox(){
  lightboxEl.classList.remove('open');
  document.body.style.overflow = lightboxState.bodyOverflow || '';
  lightboxState.isOpen = false;
  lightboxState.scale = 1;
  lightboxState.lastScale = 1;
  setMediaTransform('scale(1)');
  videoEl.pause();
  if(lightboxState.triggerEl && typeof lightboxState.triggerEl.focus === 'function'){
    lightboxState.triggerEl.focus({ preventScroll: true });
  }
  lightboxState.triggerEl = null;
}

function showPrev(){
  if(lightboxState.photos.length <= 1) return;
  const idx = (lightboxState.index - 1 + lightboxState.photos.length) % lightboxState.photos.length;
  setPhoto(lightboxState.photos, idx);
}

function showNext(){
  if(lightboxState.photos.length <= 1) return;
  const idx = (lightboxState.index + 1) % lightboxState.photos.length;
  setPhoto(lightboxState.photos, idx);
}

closeEl.addEventListener('click', closeLightbox);
lightboxEl.addEventListener('click', (event) => {
  if(event.target === lightboxEl) closeLightbox();
});
prevEl.addEventListener('click', showPrev);
nextEl.addEventListener('click', showNext);

let pinchStartDistance = 0;
let initialScale = 1;

function getDistance(touches){
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx*dx + dy*dy);
}

lightboxEl.addEventListener('touchstart', (event) => {
  if(event.touches.length === 1){
    lightboxState.startX = event.touches[0].clientX;
    lightboxState.startY = event.touches[0].clientY;
  }
  if(event.touches.length === 2){
    pinchStartDistance = getDistance(event.touches);
    initialScale = lightboxState.scale;
  }
});

lightboxEl.addEventListener('touchmove', (event) => {
  if(!lightboxState.isOpen) return;
  if(event.touches.length === 1){
    const dx = event.touches[0].clientX - lightboxState.startX;
    if(Math.abs(dx) > SWIPE_THRESHOLD){
      if(dx > 0) showPrev();
      else showNext();
      lightboxState.startX = event.touches[0].clientX;
    }
    event.preventDefault();
  }
  if(event.touches.length === 2){
    const distance = getDistance(event.touches);
    const scale = Math.max(1, Math.min(3, initialScale * (distance / pinchStartDistance)));
    lightboxState.scale = scale;
    setMediaTransform(`scale(${scale})`);
    event.preventDefault();
  }
});

lightboxEl.addEventListener('wheel', (event) => {
  event.preventDefault();
  const delta = Math.sign(event.deltaY) * -0.1;
  const nextScale = Math.max(1, Math.min(3, lightboxState.scale + delta));
  lightboxState.scale = nextScale;
  setMediaTransform(`scale(${nextScale})`);
});

window.addEventListener('keydown', (event) => {
  if(!lightboxState.isOpen) return;
  if(event.key === 'Escape') closeLightbox();
  if(event.key === 'ArrowLeft') showPrev();
  if(event.key === 'ArrowRight') showNext();
});

export function attachLightbox(container, photos){
  const items = Array.from(container.querySelectorAll('.photo-card'));
  items.forEach((item, index) => {
    item.addEventListener('click', () => openLightbox(photos, index, item));
    item.addEventListener('keydown', (event) => {
      if(event.key === 'Enter' || event.key === ' '){
        event.preventDefault();
        openLightbox(photos, index, item);
      }
    });
  });
}

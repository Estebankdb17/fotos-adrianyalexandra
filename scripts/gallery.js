// Module responsible for rendering the photo grid
export function renderGallery(container, photos = []){
  container.innerHTML = '';
  const isEmpty = !photos || photos.length === 0;
  container.classList.toggle('photos-empty', isEmpty);
  if(isEmpty){
    renderEmptyState(container);
    return;
  }
  appendPhotos(container, photos);
}

export function renderEmptyState(container){
  const empty = document.createElement('div');
  empty.className = 'gallery-empty';
  empty.innerHTML = `
    <div class="empty-mark">❦</div>
    <h3>Aún no hay recuerdos compartidos.</h3>
    <p>Sé el primero en inmortalizar<br />un instante de este día tan especial.</p>
    <div class="empty-mark">❦</div>
  `;
  container.appendChild(empty);
}

export function appendPhotos(container, photos = [], opts = {}){
  const frag = document.createDocumentFragment();
  photos.forEach(photo => {
    const card = document.createElement('article');
    card.className = photo.type === 'video' ? 'photo-card photo-card-video' : 'photo-card';
    card.setAttribute('tabindex','0');

    const media = createMediaElement(photo);
    card.appendChild(media);

    if(photo.type === 'video'){
      const play = document.createElement('span');
      play.className = 'video-play-icon';
      play.setAttribute('aria-hidden', 'true');
      play.textContent = '▶';
      card.appendChild(play);
    }

    if(photo.caption){
      const meta = document.createElement('div');
      meta.className = 'photo-meta small';
      meta.textContent = photo.caption;
      card.appendChild(meta);
    }

    if(opts.prepend){
      container.insertBefore(card, container.firstChild);
    } else {
      frag.appendChild(card);
    }
  });
  container.appendChild(frag);
}

function createMediaElement(photo){
  if(photo.type === 'video'){
    const video = document.createElement('video');
    video.src = photo.src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', photo.alt || 'Vídeo compartido');
    return video;
  }

  const img = document.createElement('img');
  img.src = photo.src;
  img.alt = photo.alt || 'Foto de la boda';
  return img;
}

// Module responsible for rendering the photo grid
export function renderGallery(container, photos = [], opts = {}){
  container.innerHTML = '';

  if(opts.isLoading){
    container.classList.add('photos-empty');
    renderLoadingState(container);
    return;
  }

  const isEmpty = !photos || photos.length === 0;
  container.classList.toggle('photos-empty', isEmpty);
  if(isEmpty){
    renderEmptyState(container);
    return;
  }
  appendPhotos(container, photos);
}

export function renderLoadingState(container){
  const loading = document.createElement('div');
  loading.className = 'gallery-state gallery-loading';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  loading.innerHTML = `
    <div class="empty-mark" aria-hidden="true">❦</div>
    <h3>Cargando recuerdos...</h3>
    <p>Preparando los momentos compartidos ❤️</p>
  `;
  container.appendChild(loading);
}

export function renderEmptyState(container){
  const empty = document.createElement('div');
  empty.className = 'gallery-state gallery-empty';
  empty.innerHTML = `
    <div class="empty-mark" aria-hidden="true">❦</div>
    <h3>Todavía no hay recuerdos compartidos.</h3>
    <p>Sé el primero en añadir uno ❤️</p>
    <button type="button" class="btn empty-upload-button" data-upload-trigger>Compartir fotos</button>
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
    const placeholder = document.createElement('div');
    placeholder.className = 'video-placeholder';
    placeholder.setAttribute('aria-label', photo.alt || 'Vídeo compartido');
    placeholder.innerHTML = `
      <span class="video-placeholder-mark" aria-hidden="true">❦</span>
      <span class="video-play-icon" aria-hidden="true">▶</span>
      <span class="video-placeholder-label">Vídeo</span>
    `;
    return placeholder;
  }

  const img = document.createElement('img');
  img.src = photo.src;
  img.alt = photo.alt || 'Foto de la boda';
  return img;
}

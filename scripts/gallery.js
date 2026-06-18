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
    card.className = 'photo-card';
    card.setAttribute('tabindex','0');

    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.alt || 'Foto de la boda';

    card.appendChild(img);

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

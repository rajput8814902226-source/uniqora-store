function galleryEscape(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function productGallery(product) {
  const images = [...new Set([product.image, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean))];
  const name = galleryEscape(product.name);
  return `<div class="product-gallery" aria-label="${name} photos">
    <img class="gallery-main" src="${galleryEscape(images[0])}" alt="${name} — photo 1" style="display:block;width:100%;border-radius:22px;box-shadow:0 24px 60px rgba(70,50,28,.16)">
    ${images.length > 1 ? `<div class="gallery-thumbnails" role="group" aria-label="Choose product photo" style="display:flex;gap:10px;overflow-x:auto;padding:16px 3px">
      ${images.map((src, index) => `<button type="button" class="gallery-thumbnail" aria-label="View photo ${index + 1}" aria-pressed="${index === 0}" onclick="selectGalleryPhoto(this)" style="flex:0 0 72px;width:72px;height:72px;padding:3px;border:2px solid ${index === 0 ? '#17130f' : '#e4d9ca'};border-radius:12px;background:white;cursor:pointer"><img src="${galleryEscape(src)}" alt="${name} — photo ${index + 1}" style="display:block;width:100%;height:100%;object-fit:cover;border-radius:7px"></button>`).join('')}
    </div>` : ''}
  </div>`;
}

function selectGalleryPhoto(button) {
  const gallery = button.closest('.product-gallery');
  const selected = button.querySelector('img');
  const main = gallery.querySelector('.gallery-main');
  main.src = selected.src;
  main.alt = selected.alt;
  gallery.querySelectorAll('.gallery-thumbnail').forEach(thumbnail => {
    const active = thumbnail === button;
    thumbnail.setAttribute('aria-pressed', String(active));
    thumbnail.style.borderColor = active ? '#17130f' : '#e4d9ca';
  });
}

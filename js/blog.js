const mobileButton = document.querySelector('.mobile-menu');
const mobileNav = document.querySelector('.mobile-nav');

if (mobileButton && mobileNav) {
  mobileButton.addEventListener('click', () => {
    const expanded = mobileButton.getAttribute('aria-expanded') === 'true';
    mobileButton.setAttribute('aria-expanded', String(!expanded));
    mobileButton.innerHTML = expanded ? 'МЕНЮ <span>+</span>' : 'ЗАКРЫТЬ <span>×</span>';
    mobileNav.hidden = expanded;
    mobileNav.classList.toggle('is-open', !expanded);
  });
  mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => mobileButton.click()));
}

const filters = [...document.querySelectorAll('[data-filter]')];
const records = [...document.querySelectorAll('[data-record]')];

filters.forEach((filter) => filter.addEventListener('click', () => {
  const selected = filter.dataset.filter;
  filters.forEach((item) => item.classList.toggle('is-active', item === filter));
  records.forEach((record) => record.classList.toggle('is-hidden', selected !== 'all' && record.dataset.record !== selected));
}));

document.querySelectorAll('[data-expand]').forEach((button) => button.addEventListener('click', () => {
  const record = button.closest('.record');
  const extra = record.querySelector('.record-extra');
  const isHidden = extra.hidden;
  extra.hidden = !isHidden;
  button.innerHTML = isHidden ? 'СВЕРНУТЬ ЗАПИСЬ <b>−</b>' : 'РАЗВЕРНУТЬ ЗАПИСЬ <b>+</b>';
}));

const imageModal = document.querySelector('[data-image-modal]');
const modalImage = document.querySelector('[data-image-modal-image]');
const modalCaption = document.querySelector('[data-image-modal-caption]');
const closeModalButton = document.querySelector('[data-image-modal-close]');
let modalTrigger = null;

const closeImageModal = () => {
  if (imageModal?.open) imageModal.close();
};

if (imageModal && modalImage && modalCaption && closeModalButton) {
  const zoomableImages = [...document.querySelectorAll('.image-strip img, .logo-sheet img')];

  const openImageModal = (image) => {
    modalTrigger = image;
    imageModal.classList.remove('is-zoomed');
    modalImage.src = image.currentSrc || image.src;
    modalImage.alt = image.alt;
    modalImage.tabIndex = 0;
    modalImage.setAttribute('role', 'button');
    modalImage.setAttribute('aria-label', 'Увеличить изображение');
    modalCaption.textContent = `${image.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || image.alt} / НАЖМИТЕ НА КАДР, ЧТОБЫ УВЕЛИЧИТЬ`;
    document.body.classList.add('is-modal-open');
    imageModal.showModal();
  };

  const toggleImageZoom = () => {
    const isZoomed = imageModal.classList.toggle('is-zoomed');
    modalImage.setAttribute('aria-label', isZoomed ? 'Вернуть исходный масштаб изображения' : 'Увеличить изображение');
    modalCaption.textContent = `${modalTrigger?.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || modalTrigger?.alt || ''} / ${isZoomed ? 'ЛИСТАЙТЕ КАДР. НАЖМИТЕ, ЧТОБЫ ВЕРНУТЬ МАСШТАБ' : 'НАЖМИТЕ НА КАДР, ЧТОБЫ УВЕЛИЧИТЬ'}`;
  };

  zoomableImages.forEach((image) => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Открыть крупно: ${image.alt}`);
    image.addEventListener('click', () => openImageModal(image));
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openImageModal(image);
      }
    });
  });

  closeModalButton.addEventListener('click', closeImageModal);
  modalImage.addEventListener('click', toggleImageZoom);
  modalImage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleImageZoom();
    }
  });
  imageModal.addEventListener('click', (event) => {
    if (event.target === imageModal) closeImageModal();
  });
  imageModal.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeImageModal();
  });
  imageModal.addEventListener('close', () => {
    document.body.classList.remove('is-modal-open');
    imageModal.classList.remove('is-zoomed');
    modalTrigger?.focus();
  });
}

const revealObserver = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
  if (isIntersecting) target.classList.add('is-visible');
}), { threshold: .12 });

document.querySelectorAll('.reveal').forEach((node) => revealObserver.observe(node));

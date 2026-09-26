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

const cards = [...document.querySelectorAll('.personnel-card')];
const setOpen = (card, open) => {
  card.classList.toggle('is-open', open);
  const button = card.querySelector('.personnel-trigger');
  button.setAttribute('aria-expanded', String(open));
  button.querySelector('.file-toggle').textContent = open ? '−' : '+';
};
cards.forEach((card) => {
  const button = card.querySelector('.personnel-trigger');
  button.addEventListener('click', () => setOpen(card, !card.classList.contains('is-open')));
  card.addEventListener('keydown', (event) => {
    if (event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setOpen(card, !card.classList.contains('is-open'));
  });
});

const filterButtons = [...document.querySelectorAll('[data-filter]')];
const emptyState = document.querySelector('[data-filter-empty]');
filterButtons.forEach((button) => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  let visible = 0;
  filterButtons.forEach((item) => item.classList.toggle('is-selected', item === button));
  cards.forEach((card) => {
    const matches = filter === 'all' || card.dataset.person.split(' ').includes(filter);
    card.classList.toggle('is-hidden', !matches);
    if (matches) visible += 1;
  });
  emptyState.hidden = visible > 0;
}));

const authorLog = document.querySelector('[data-author-log]');
const logStates = ['SYNC // FILES READY', 'LINK // PERSONNEL ONLINE', 'CACHE // RECORDS VERIFIED', 'A.R.I. // CONNECTION STABLE'];
let logIndex = 0;
document.querySelector('[data-author-scan]')?.addEventListener('click', () => {
  logIndex = (logIndex + 1) % logStates.length;
  authorLog.style.opacity = '0';
  window.setTimeout(() => { authorLog.textContent = logStates[logIndex]; authorLog.style.opacity = '1'; }, 150);
});

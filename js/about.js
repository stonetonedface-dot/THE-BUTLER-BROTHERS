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

const timelineCards = [...document.querySelectorAll('.timeline-card')];
timelineCards.forEach((card) => card.addEventListener('click', () => {
  const shouldOpen = !card.classList.contains('is-open');
  timelineCards.forEach((item) => {
    item.classList.toggle('is-open', item === card && shouldOpen);
    item.setAttribute('aria-expanded', String(item === card && shouldOpen));
    item.querySelector('i').textContent = item === card && shouldOpen ? '−' : '+';
  });
}));

const departmentEntries = {
  '01': 'ИГРЫ И ДИЗАЙН // превращаем идею в мир, у которого есть правила и выход.',
  '02': 'ИСТОРИИ И ПЕРСОНАЖИ // ищем голоса, характеры и вопросы, которые хочется оставить с игроком.',
  '03': '3D И ПРОГРАММИРОВАНИЕ // собираем формы, пространства и системы, которые начинают работать.',
  '04': 'МУЗЫКА, ЗВУК И ОЗВУЧКА // даём миру шум, ритм и возможность ответить.',
};
const departmentOutput = document.querySelector('[data-department-output]');
document.querySelectorAll('[data-department]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-department]').forEach((item) => item.classList.toggle('is-selected', item === button));
  departmentOutput.style.opacity = '0';
  window.setTimeout(() => { departmentOutput.textContent = departmentEntries[button.dataset.department]; departmentOutput.style.opacity = '1'; }, 140);
}));

const archiveStatus = document.querySelector('[data-archive-status]');
const archiveStates = ['АРХИВ // 06 УЧАСТНИКОВ НА СВЯЗИ', 'АРХИВ // НОВАЯ ЗАПИСЬ СОХРАНЕНА', 'АРХИВ // ИДЕЯ ПРИНЯТА В РАБОТУ', 'АРХИВ // СИГНАЛ СТАБИЛЕН'];
let archiveIndex = 0;
document.querySelector('[data-sync-archive]')?.addEventListener('click', () => {
  archiveIndex = (archiveIndex + 1) % archiveStates.length;
  archiveStatus.style.opacity = '0';
  window.setTimeout(() => { archiveStatus.textContent = archiveStates[archiveIndex]; archiveStatus.style.opacity = '1'; }, 150);
});

const revealObserver = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
  if (isIntersecting) target.classList.add('is-visible');
}), { threshold: .13 });
document.querySelectorAll('.reveal').forEach((node) => revealObserver.observe(node));

const sectionLinks = [...document.querySelectorAll('.section-nav a')];
const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
const navigationObserver = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
  if (isIntersecting) sectionLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${target.id}`));
}), { rootMargin: '-38% 0px -54% 0px', threshold: 0 });
sections.forEach((section) => navigationObserver.observe(section));

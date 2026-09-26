const routes = {
  front: { code: 'SECTOR 01', label: 'FRONT DESK', marker: 'YOU ARE HERE', log: 'СИСТЕМА: ДОБРО ПОЖАЛОВАТЬ, ПОСЕТИТЕЛЬ.\nМАРШРУТ НАЙДЕН.' },
  office: { code: 'SECTOR 02', label: 'OFFICE ARCHIVES', marker: 'ARCHIVE OPEN', log: 'СИСТЕМА: КАРТОТЕКА ДОСТУПНА.\nНЕ ВСЕ ЯЩИКИ ЗНАЧАТСЯ В РЕЕСТРЕ.' },
  lower: { code: 'SECTOR ??', label: 'UNLISTED LEVEL', marker: 'SIGNAL LOST', log: 'СИСТЕМА: МАРШРУТ ОТСУТСТВУЕТ.\nПРОДОЛЖИТЬ ПОИСК? [ДА]' },
};

const routeButtons = [...document.querySelectorAll('[data-route]')];
const floorMap = document.querySelector('[data-floor-map]');
const terminalCode = document.querySelector('[data-terminal-code]');
const mapLabel = document.querySelector('[data-map-label]');
const mapMarker = document.querySelector('[data-map-marker]');
const terminalLog = document.querySelector('[data-terminal-log]');
routeButtons.forEach((button) => button.addEventListener('click', () => {
  const route = routes[button.dataset.route];
  routeButtons.forEach((item) => {
    const selected = item === button;
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-selected', String(selected));
  });
  floorMap.dataset.route = button.dataset.route;
  terminalCode.textContent = route.code;
  mapLabel.textContent = route.label;
  mapMarker.textContent = route.marker;
  terminalLog.style.opacity = '0';
  window.setTimeout(() => { terminalLog.textContent = route.log; terminalLog.style.opacity = '1'; }, 140);
}));

const signalMessages = [
  '«Шелли? Если вы слышите меня — не уходите из освещённых коридоров.»',
  '«Служебный лифт работает. Это не значит, что он предназначен для вас.»',
  '«В архиве есть записка. Не читайте её вслух, пока вы не одна.»',
  '«Я знаю, что вы не помните это место. Место помнит вас.»',
];
let signalIndex = 0;
const signalText = document.querySelector('[data-signal-message]');
document.querySelector('[data-next-signal]')?.addEventListener('click', () => {
  signalIndex = (signalIndex + 1) % signalMessages.length;
  signalText.style.opacity = '0';
  window.setTimeout(() => { signalText.textContent = signalMessages[signalIndex]; signalText.style.opacity = '1'; }, 160);
});

const lobbyWindow = document.querySelector('.lobby-window');
const windowModeButton = document.querySelector('[data-window-mode]');
windowModeButton?.addEventListener('click', () => {
  const alternate = lobbyWindow.classList.toggle('is-alternate');
  windowModeButton.textContent = alternate ? 'ВОССТАНОВИТЬ ФИЛЬТР' : 'ПЕРЕКЛЮЧИТЬ ФИЛЬТР';
});

const badgeNames = ['ШЕЛЛИ', 'ГОСТЬ 017', 'СОТРУДНИК', 'НЕ УСТАНОВЛЕНО'];
const badgeStatuses = ['АДМИНИСТРАТИВНЫЙ ХОЛЛ', 'ВРЕМЕННЫЙ ДОПУСК', 'МАРШРУТ НЕ НАЗНАЧЕН', 'ПРОВЕРИТЬ ПО ЛИНИИ 04'];
const pad = (value) => String(value).padStart(2, '0');
document.querySelector('[data-open-badge]')?.addEventListener('click', () => {
  const card = document.querySelector('[data-badge-card]');
  const id = Math.floor(Math.random() * 900) + 100;
  const minute = Math.floor(Math.random() * 59);
  const hour = Math.floor(Math.random() * 10) + 8;
  const index = Math.floor(Math.random() * badgeNames.length);
  document.querySelector('[data-badge-number]').textContent = `V-${id}-1994`;
  document.querySelector('[data-badge-name]').textContent = badgeNames[index];
  document.querySelector('[data-badge-status]').textContent = badgeStatuses[index];
  document.querySelector('[data-badge-time]').textContent = `${pad(hour)}:${pad(minute)}`;
  card.classList.remove('is-issued');
  window.requestAnimationFrame(() => card.classList.add('is-issued'));
});

const mobileButton = document.querySelector('.portal-menu');
const mobileDrawer = document.querySelector('.mobile-drawer');
if (mobileButton && mobileDrawer) {
  mobileButton.addEventListener('click', () => {
    const expanded = mobileButton.getAttribute('aria-expanded') === 'true';
    mobileButton.setAttribute('aria-expanded', String(!expanded));
    mobileButton.innerHTML = expanded ? 'МЕНЮ <span>≡</span>' : 'ЗАКРЫТЬ <span>×</span>';
    mobileDrawer.hidden = expanded;
    mobileDrawer.classList.toggle('is-open', !expanded);
  });
  mobileDrawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => mobileButton.click()));
}

const revealObserver = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
  if (isIntersecting) target.classList.add('is-visible');
}), { threshold: .13 });
document.querySelectorAll('.reveal').forEach((node) => revealObserver.observe(node));

const sectionLinks = [...document.querySelectorAll('.route-nav a')];
const sections = sectionLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
const navigationObserver = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
  if (isIntersecting) sectionLinks.forEach((link) => link.classList.toggle('is-active', link.getAttribute('href') === `#${target.id}`));
}), { rootMargin: '-38% 0px -54% 0px', threshold: 0 });
sections.forEach((section) => navigationObserver.observe(section));

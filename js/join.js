(() => {
  const form = document.querySelector('[data-application-form]');
  const status = document.querySelector('[data-form-status]');
  const output = document.querySelector('[data-application-output]');
  const contactLink = document.querySelector('[data-contact-link]');

  if (!form || !status || !output || !contactLink) return;

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      output.hidden = false;
      output.focus();
      output.select();
      return false;
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const entry = [
      'THE BUTLER BROTHERS / ЗАЯВКА',
      '',
      `Имя: ${data.get('name')}`,
      `Направление: ${data.get('direction')}`,
      `Связь: ${data.get('contact')}`,
      '',
      'О себе:',
      data.get('about'),
      data.get('portfolio') ? `\nРаботы: ${data.get('portfolio')}` : '',
    ].filter(Boolean).join('\n');

    output.value = entry;
    const copied = await copyText(entry);
    contactLink.href = contactLink.dataset.href;
    contactLink.setAttribute('aria-disabled', 'false');
    contactLink.classList.add('is-ready');
    status.textContent = copied
      ? 'Заявка скопирована. Теперь открой сообщения VK и вставь её в диалог.'
      : 'Заявка подготовлена ниже. Скопируй её вручную, затем открой сообщения VK.';
  });
})();

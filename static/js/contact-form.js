// EasyFile Tools contact: fields only, no browser IP collection, no local persistence.
(() => {
  const form = document.querySelector('#eft-contact-form');
  if (!form) return;
  const description = form.querySelector('#eft-contact-description');
  const counter = form.querySelector('#eft-contact-counter');
  const status = form.querySelector('#eft-contact-status');
  const submit = form.querySelector('button[type="submit"]');
  const kind = form.querySelector('#eft-contact-kind');
  const tool = form.querySelector('#eft-contact-tool');
  const steps = form.querySelector('#eft-contact-steps');
  const wordCount = (text) => text.trim().split(/\s+/u).filter(Boolean).length;
  function show(text, type = '') { status.textContent = text; status.dataset.type = type; }
  function syncWords() {
    const count = wordCount(description.value);
    counter.textContent = `${count} / 30 words`;
    counter.classList.toggle('eft-contact-over', count > 30);
    return count <= 30;
  }
  function syncRequired() {
    const isProblem = kind.value === 'problem';
    tool.required = isProblem;
    steps.required = isProblem;
    form.querySelectorAll('.eft-contact-problem-required').forEach(el => { el.hidden = !isProblem; });
  }
  kind.addEventListener('change', syncRequired);
  description.addEventListener('input', syncWords);
  syncRequired(); syncWords();
  if (form.dataset.ready !== 'true') return; // no Turnstile site key: not active yet
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!syncWords()) { show('Please limit the description to 30 words.', 'error'); description.focus(); return; }
    if (!form.reportValidity()) return;
    const token = form.querySelector('[name="cf-turnstile-response"]')?.value || '';
    if (!token) { show('Please complete the verification before sending.', 'error'); return; }
    const fields = Object.fromEntries(new FormData(form));
    const payload = {
      kind: fields.kind || '', tool: fields.tool || '', browser: fields.browser || '', os: fields.os || '',
      inputFormat: fields.inputFormat || '', outputFormat: fields.outputFormat || '',
      description: fields.description || '', steps: fields.steps || '', errorMessage: fields.errorMessage || '',
      website: fields.website || '', turnstileToken: token,
    };
    submit.disabled = true;
    show('Sending message…');
    try {
      const reply = await fetch('/api/contact', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await reply.json().catch(() => ({}));
      if (!reply.ok) { show(data.message || 'Could not send the message. Please try again.', 'error'); return; }
      form.reset(); syncRequired(); syncWords();
      show(data.message || 'Thank you. Your report has been submitted.', 'success');
    } catch {
      show('Connection problem. Your message was not sent; please try again.', 'error');
    } finally {
      if (typeof window.turnstile?.reset === 'function') window.turnstile.reset();
      submit.disabled = false;
    }
  });
})();

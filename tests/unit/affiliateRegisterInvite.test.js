describe('affiliate-register-invite (invite gate)', () => {
  let elements;
  let originalWindow, originalDocument, originalFetch;

  const makeEl = () => ({
    value: '',
    readOnly: false,
    classList: { add: jest.fn(), remove: jest.fn() },
    setAttribute: jest.fn()
  });

  const loadScript = async () => {
    // jest.resetModules() (not `delete require.cache[...]`, which is a no-op in
    // Jest's module registry) so the IIFE re-evaluates and init() re-runs per test.
    jest.resetModules();
    require('../../public/assets/js/affiliate-register-invite.js');
    // The script auto-runs init() when readyState !== 'loading'; flush async work.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  };

  beforeEach(() => {
    originalWindow = global.window;
    originalDocument = global.document;
    originalFetch = global.fetch;

    elements = {
      affiliateRegistrationForm: makeEl(),
      inviteInvalidNotice: makeEl(),
      inviteEmailLockedNote: makeEl(),
      inviteToken: makeEl(),
      email: makeEl(),
      firstName: makeEl(),
      lastName: makeEl(),
      businessName: makeEl(),
      phone: makeEl()
    };

    global.document = {
      readyState: 'complete',
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => elements[id] || null)
    };
    global.window = {
      location: { search: '', origin: 'https://wavemax.promo' },
      EMBED_CONFIG: { baseUrl: 'https://wavemax.promo' }
    };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.window = originalWindow;
    global.document = originalDocument;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('no ?invite= param → form hidden, invalid notice shown, no fetch', async () => {
    global.window.location.search = '';
    await loadScript();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(elements.affiliateRegistrationForm.classList.add).toHaveBeenCalledWith('hidden');
    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });

  test('valid invite → token stored, email locked + prefill applied', async () => {
    const raw = 'ab'.repeat(32);
    global.window.location.search = `?route=/affiliate-register&invite=${raw}`;
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        valid: true,
        email: 'invitee@example.com',
        prefill: { firstName: 'Ina', lastName: 'Vite', businessName: 'Vite LLC', phone: '555-0100' }
      })
    });

    await loadScript();

    expect(global.fetch).toHaveBeenCalledWith(
      `https://wavemax.promo/api/v1/affiliate-invites/${raw}/validate`,
      { credentials: 'include' }
    );
    expect(elements.inviteToken.value).toBe(raw);
    expect(elements.email.value).toBe('invitee@example.com');
    expect(elements.email.readOnly).toBe(true);
    expect(elements.inviteEmailLockedNote.classList.remove).toHaveBeenCalledWith('hidden');
    expect(elements.firstName.value).toBe('Ina');
    expect(elements.businessName.value).toBe('Vite LLC');
    // Existing user input is never overwritten:
    expect(elements.lastName.value).toBe('Vite');
  });

  test('410 from validate → invalid state', async () => {
    global.window.location.search = '?invite=' + 'cd'.repeat(32);
    global.fetch.mockResolvedValue({ ok: false, status: 410, json: async () => ({ valid: false }) });

    await loadScript();

    expect(elements.affiliateRegistrationForm.classList.add).toHaveBeenCalledWith('hidden');
    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });

  test('network failure → invalid state (fail closed)', async () => {
    global.window.location.search = '?invite=' + 'ef'.repeat(32);
    global.fetch.mockRejectedValue(new Error('offline'));

    await loadScript();

    expect(elements.inviteInvalidNotice.classList.remove).toHaveBeenCalledWith('hidden');
  });
});

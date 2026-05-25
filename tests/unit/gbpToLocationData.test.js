const gbpToLocationData = require('../../server/services/gbpToLocationData');

const GBP = {
  placeId: 'PLACE-1',
  name: 'WaveMAX Laundry Austin',
  formattedAddress: '825 E Rundberg Ln, Austin, TX 78753, USA',
  phone: '+1 512-553-1674',
  hours: ['Monday: 7 AM–9 PM', 'Tuesday: 7 AM–9 PM'],
  location: { latitude: 30.356606, longitude: -97.686748 },
  mapsUri: 'https://maps.google.com/?cid=123',
  rating: 4.8,
  userRatingCount: 48
};

describe('gbpToLocationData', () => {
  it('overlays GBP identity onto the LOCATION_DATA shape', () => {
    const d = gbpToLocationData(GBP, { slug: 'austin-tx' });
    expect(d.slug).toBe('austin-tx');
    expect(d.isPreview).toBe(true);
    expect(d.brand.name).toBe('WaveMAX Laundry Austin');
    expect(d.contact.address).toBe('825 E Rundberg Ln');
    expect(d.contact.city).toBe('Austin');
    expect(d.contact.state).toBe('TX');
    expect(d.contact.zip).toBe('78753');
    expect(d.contact.addressLine2).toBe('Austin, TX 78753');
    expect(d.contact.geo).toEqual({ lat: 30.356606, lng: -97.686748 });
    expect(d.contact.phoneTel).toBe('tel:+15125531674');
    expect(d.contact.mapsUrl).toBe('https://maps.google.com/?cid=123');
    expect(d.contact.mapsEmbedUrl).toContain('output=embed');
    expect(d.google.placeId).toBe('PLACE-1');
  });

  it('parses GBP opening hours into a display + last-wash time', () => {
    const d = gbpToLocationData(GBP, { slug: 'x' });
    expect(d.hours.display).toBe('7am-9pm');
    expect(d.hours.lastWash).toBe('9pm');
  });

  it('fills all template-required fields with sane defaults', () => {
    const d = gbpToLocationData(GBP, { slug: 'x' });
    expect(d.pricing.wdf.display).toBeTruthy();
    expect(Array.isArray(d.amenities) && d.amenities.length).toBeTruthy();
    expect(d.serviceArea).toContain('Austin');
    expect(d.images.ogImage).toMatch(/^https?:\/\//);
    expect(d.seo.localizedHeadlines.landingTitle).toContain('Austin');
    expect(d.nav.commercialEnabled).toBe(true);
    expect(d.i18n.languagesAvailable).toEqual(['en', 'es', 'pt', 'de']);
  });

  it('degrades gracefully when GBP fields are missing', () => {
    const d = gbpToLocationData({ name: 'Bare Biz' }, { slug: 'bare' });
    expect(d.brand.name).toBe('Bare Biz');
    expect(d.contact.geo).toEqual({ lat: null, lng: null });
    expect(d.hours.display).toBe('See Google for hours');
    expect(d.contact.phoneTel).toBe('');           // no phone → empty, not "tel:"
    expect(d.serviceArea).toEqual([]);             // no city
  });

  it('parseAddress handles an address without a country suffix', () => {
    const { parseAddress } = gbpToLocationData._internals;
    expect(parseAddress('100 Main St, Dallas, TX 75201')).toEqual({
      street: '100 Main St', city: 'Dallas', state: 'TX', zip: '75201'
    });
  });
});

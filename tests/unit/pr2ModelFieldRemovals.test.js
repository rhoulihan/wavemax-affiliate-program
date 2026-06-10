// PR 2 — spec §4.5/§4.6 field removals, pinned at the schema level.
const Affiliate = require('../../server/models/Affiliate');

describe('Affiliate schema — scheduling / Pickup Now fields removed', () => {
  it('availabilitySchedule paths are gone', () => {
    expect(Affiliate.schema.path('availabilitySchedule.weeklyTemplate.monday.enabled')).toBeUndefined();
    expect(Affiliate.schema.path('availabilitySchedule.scheduleSettings.advanceBookingDays')).toBeUndefined();
  });

  it('allowImmediatePickup is gone', () => {
    expect(Affiliate.schema.path('allowImmediatePickup')).toBeUndefined();
  });

  it('schedule instance methods are gone', () => {
    expect(Affiliate.schema.methods.isAvailable).toBeUndefined();
    expect(Affiliate.schema.methods.getAvailableTimeSlots).toBeUndefined();
    expect(Affiliate.schema.methods.getAvailableDates).toBeUndefined();
    expect(Affiliate.schema.methods.validateScheduleChange).toBeUndefined();
    expect(Affiliate.schema.methods.getDayOfWeekKey).toBeUndefined();
  });
});

describe('Affiliate schema — service-area fields removed', () => {
  it('service-area paths are gone', () => {
    expect(Affiliate.schema.path('serviceLocation.coordinates')).toBeUndefined();
    expect(Affiliate.schema.path('serviceLatitude')).toBeUndefined();
    expect(Affiliate.schema.path('serviceLongitude')).toBeUndefined();
    expect(Affiliate.schema.path('serviceRadius')).toBeUndefined();
  });

  it('the 2dsphere index is gone', () => {
    const geoIndex = Affiliate.schema.indexes().find(([fields]) => fields.serviceLocation);
    expect(geoIndex).toBeUndefined();
  });
});

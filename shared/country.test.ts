import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCountry } from './country';
import { insertTestSessionSchema, serviceTypes } from './schema';

const aliases = ['newzealand', 'new_zealand', 'New Zealand', 'NEW_ZEALAND', 'new-zealand', ' New Zealand '];

test('normalizes New Zealand spellings without changing other countries or form types', () => {
  for (const country of aliases) assert.equal(normalizeCountry(country), 'newzealand');
  for (const country of ['australia', 'national_client', 'reflections', 'custom_123', 'unknown']) {
    assert.equal(normalizeCountry(country), country);
  }
});

test('session validation normalizes web and mobile country values for every service', () => {
  for (const serviceType of serviceTypes) {
    for (const country of aliases) {
      const parsed = insertTestSessionSchema.parse({
        serviceType, country, testDate: '2026-09-03', technicianName: 'Test',
        clientName: 'Test', siteContact: 'Test', address: 'Test address',
      });
      assert.equal(parsed.country, 'newzealand');
    }
  }
});

// ============================================================
// Tests for generate-license edge function logic
// Run with: deno test --allow-env supabase/functions/generate-license/index.test.ts
// ============================================================

import { assertEquals, assertMatch, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'

// ── Replicate pure logic from the function ───────────────────

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSegment(len: number): string {
  return Array.from({ length: len }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}

function generateKeys(
  quantity: number,
  prefix: string,
  year: number,
): string[] {
  const keys: string[] = []
  while (keys.length < quantity) {
    const key = `${prefix}-${year}-${randomSegment(4)}-${randomSegment(4)}`
    if (!keys.includes(key)) keys.push(key)
  }
  return keys
}

function sanitizePrefix(raw: string): string {
  return (raw || 'GEOLEARN')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12) || 'GEOLEARN'
}

function clampQuantity(v: unknown): number {
  return Math.min(Math.max(Number(v) || 5, 1), 50)
}

function clampMaxDevices(v: unknown): number {
  return Math.min(Math.max(Number(v) || 2, 1), 10)
}

// ── Tests ────────────────────────────────────────────────────

Deno.test('key format matches PREFIX-YEAR-XXXX-XXXX', () => {
  const keys = generateKeys(10, 'GEOLEARN', 2026)
  const pattern = /^GEOLEARN-2026-[A-Z2-9]{4}-[A-Z2-9]{4}$/
  for (const key of keys) {
    assertMatch(key, pattern, `Key "${key}" does not match expected format`)
  }
})

Deno.test('generated keys contain only allowed characters', () => {
  const keys = generateKeys(20, 'GEOLEARN', 2026)
  const forbidden = /[IO01]/
  for (const key of keys) {
    const segments = key.split('-').slice(2) // skip prefix and year
    for (const seg of segments) {
      assertEquals(
        forbidden.test(seg),
        false,
        `Key "${key}" contains forbidden character (I/O/0/1)`
      )
    }
  }
})

Deno.test('all generated keys are unique', () => {
  const keys = generateKeys(50, 'GEOLEARN', 2026)
  const unique = new Set(keys)
  assertEquals(unique.size, 50, 'Duplicate keys were generated')
})

Deno.test('quantity is clamped between 1 and 50', () => {
  assertEquals(clampQuantity(0), 1)
  assertEquals(clampQuantity(-5), 1)
  assertEquals(clampQuantity(51), 50)
  assertEquals(clampQuantity(100), 50)
  assertEquals(clampQuantity(10), 10)
  assertEquals(clampQuantity(undefined), 5)   // default
  assertEquals(clampQuantity('abc'), 5)        // NaN → default
})

Deno.test('max_devices is clamped between 1 and 10', () => {
  assertEquals(clampMaxDevices(0), 1)
  assertEquals(clampMaxDevices(-1), 1)
  assertEquals(clampMaxDevices(11), 10)
  assertEquals(clampMaxDevices(99), 10)
  assertEquals(clampMaxDevices(3), 3)
  assertEquals(clampMaxDevices(undefined), 2)  // default
})

Deno.test('prefix sanitization strips special chars and uppercases', () => {
  assertEquals(sanitizePrefix('geolearn'), 'GEOLEARN')
  assertEquals(sanitizePrefix('my-prefix!'), 'MYPREFIX')
  assertEquals(sanitizePrefix('test 123'), 'TEST123')
  assertEquals(sanitizePrefix(''), 'GEOLEARN')           // fallback
  assertEquals(sanitizePrefix('!!!'), 'GEOLEARN')        // all stripped → fallback
  assertEquals(sanitizePrefix('TOOLONGPREFIXNAME'), 'TOOLONGPREFI') // truncated to 12
})

Deno.test('custom prefix is used in generated keys', () => {
  const keys = generateKeys(5, 'CUSTOM', 2026)
  for (const key of keys) {
    assertMatch(key, /^CUSTOM-2026-/, `Key "${key}" does not use custom prefix`)
  }
})

Deno.test('generateKeys returns exact quantity requested', () => {
  for (const qty of [1, 5, 10, 25, 50]) {
    const keys = generateKeys(qty, 'GEOLEARN', 2026)
    assertEquals(keys.length, qty, `Expected ${qty} keys, got ${keys.length}`)
  }
})

Deno.test('each key segment is exactly 4 characters', () => {
  const keys = generateKeys(10, 'GEOLEARN', 2026)
  for (const key of keys) {
    const parts = key.split('-')
    // format: PREFIX-YEAR-SEG1-SEG2
    assertEquals(parts.length, 4, `Key "${key}" has wrong number of segments`)
    assertEquals(parts[2].length, 4, `Segment 3 of "${key}" is not 4 chars`)
    assertEquals(parts[3].length, 4, `Segment 4 of "${key}" is not 4 chars`)
  }
})

Deno.test('two batches produce different keys', () => {
  const batch1 = generateKeys(10, 'GEOLEARN', 2026)
  const batch2 = generateKeys(10, 'GEOLEARN', 2026)
  // With 32^8 ≈ 1 trillion combinations, collision across batches is astronomically unlikely
  const overlap = batch1.filter(k => batch2.includes(k))
  assertEquals(overlap.length, 0, `Unexpected key collision between batches: ${overlap}`)
})

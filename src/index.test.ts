import { describe, expect, it } from 'vitest'
import { VERSION } from './index'

describe('stream-ui', () => {
  it('exports a version', () => {
    expect(VERSION).toBe('0.0.1')
  })
})

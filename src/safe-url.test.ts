import { beforeEach, describe, expect, it, vi } from 'vitest'
import { safeHref, safeImageSrc } from './safe-url'

describe('safeHref', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('allows http/https absolute URLs', () => {
    expect(safeHref('https://example.com/')).toContain('example.com')
    expect(safeHref('http://example.com/')).toContain('example.com')
  })

  it('allows mailto and tel', () => {
    expect(safeHref('mailto:a@b.com')).toContain('mailto')
    expect(safeHref('tel:+15551234')).toContain('tel')
  })

  it('allows relative paths, fragments, and query strings', () => {
    expect(safeHref('/foo')).toBe('/foo')
    expect(safeHref('#anchor')).toBe('#anchor')
    expect(safeHref('?q=1')).toBe('?q=1')
    expect(safeHref('foo/bar')).toBe('foo/bar')
  })

  it('rejects javascript: URLs', () => {
    expect(safeHref('javascript:alert(1)')).toBe('about:blank')
  })

  it('rejects data: URLs (generic) on links', () => {
    expect(safeHref('data:text/html,<script>alert(1)</script>')).toBe('about:blank')
  })

  it('rejects file: URLs', () => {
    expect(safeHref('file:///etc/passwd')).toBe('about:blank')
  })

  it('returns about:blank for non-string input', () => {
    expect(safeHref(undefined)).toBe('about:blank')
    expect(safeHref(null)).toBe('about:blank')
    expect(safeHref(42)).toBe('about:blank')
  })
})

describe('safeImageSrc', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('allows http/https image URLs', () => {
    expect(safeImageSrc('https://cdn.example.com/a.png')).toContain('cdn.example.com')
  })

  it('allows data:image/* URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0K'
    expect(safeImageSrc(dataUrl)).toBe(dataUrl)
  })

  it('allows relative image paths', () => {
    expect(safeImageSrc('/img/x.png')).toBe('/img/x.png')
    expect(safeImageSrc('./x.png')).toBe('./x.png')
    expect(safeImageSrc('../img/x.png')).toBe('../img/x.png')
  })

  it('rejects javascript: URLs', () => {
    expect(safeImageSrc('javascript:alert(1)')).toBe('')
  })

  it('rejects non-image data: URLs', () => {
    expect(safeImageSrc('data:text/html,<script>alert(1)</script>')).toBe('')
  })

  it('returns empty string for non-string input', () => {
    expect(safeImageSrc(undefined)).toBe('')
    expect(safeImageSrc(null)).toBe('')
  })
})

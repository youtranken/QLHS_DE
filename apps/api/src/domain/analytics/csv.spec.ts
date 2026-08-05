import { describe, it, expect } from 'vitest'
import { toCsv } from './csv'

describe('toCsv', () => {
  it('prefixes a BOM and joins with CRLF', () => {
    const out = toCsv(['a', 'b'], [[1, 2]])
    expect(out).toBe('﻿a,b\r\n1,2\r\n')
  })

  it('quotes fields with commas, quotes or newlines and doubles quotes', () => {
    const out = toCsv(['x'], [['a,b'], ['he said "hi"'], ['line1\nline2']])
    expect(out).toBe('﻿x\r\n"a,b"\r\n"he said ""hi"""\r\n"line1\nline2"\r\n')
  })

  it('neutralizes a leading formula trigger so Excel treats the cell as text (CSV injection)', () => {
    // A DCC return-reason like =HYPERLINK(...) must not execute when the Admin
    // opens the export. Prefix an apostrophe; Excel then shows it as plain text.
    const out = toCsv(['x'], [['=1+2'], ['+cmd'], ['-8'], ['@ref'], ['\ttab'], ['safe']])
    expect(out).toBe("﻿x\r\n'=1+2\r\n'+cmd\r\n'-8\r\n'@ref\r\n'\ttab\r\nsafe\r\n")
  })

  it('leaves a numeric cell intact — a negative number is not a formula', () => {
    expect(toCsv(['n'], [[-5]])).toBe('﻿n\r\n-5\r\n')
  })
})

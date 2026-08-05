import { describe, it, expect } from 'vitest'
import { buildCsv } from './csv'

describe('buildCsv', () => {
  it('joins header + rows with CRLF', () => {
    expect(buildCsv(['A', 'B'], [['1', '2'], ['3', '4']])).toBe('A,B\r\n1,2\r\n3,4')
  })

  it('quotes cells containing comma, quote or newline (doubling inner quotes)', () => {
    const csv = buildCsv(['x'], [['a,b'], ['say "hi"'], ['two\nlines']])
    expect(csv).toBe('x\r\n"a,b"\r\n"say ""hi"""\r\n"two\nlines"')
  })

  it('renders null/undefined as empty and coerces numbers', () => {
    expect(buildCsv(['a', 'b', 'c'], [[null, undefined, 42]])).toBe('a,b,c\r\n,,42')
  })

  it('neutralizes a leading formula trigger so Excel treats the cell as text (CSV injection)', () => {
    // A contractor name like =cmd|'/c calc'!A1 must not execute on export.
    const csv = buildCsv(['x'], [['=1+2'], ['+cmd'], ['-8'], ['@ref'], ['\ttab'], ['safe']])
    expect(csv).toBe("x\r\n'=1+2\r\n'+cmd\r\n'-8\r\n'@ref\r\n'\ttab\r\nsafe")
  })

  it('leaves a numeric cell intact — a negative number is not a formula', () => {
    expect(buildCsv(['n'], [[-5]])).toBe('n\r\n-5')
  })
})

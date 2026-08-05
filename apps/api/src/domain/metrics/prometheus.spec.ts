import { describe, it, expect } from 'vitest'
import { renderPrometheus, type MetricFamily } from './prometheus'

describe('renderPrometheus', () => {
  it('emits HELP and TYPE headers before the samples', () => {
    const out = renderPrometheus([
      { name: 'qlhs_up', help: 'API is serving', type: 'gauge', samples: [{ value: 1 }] },
    ])
    expect(out).toBe(
      '# HELP qlhs_up API is serving\n# TYPE qlhs_up gauge\nqlhs_up 1\n',
    )
  })

  it('renders labels sorted and quoted, one line per sample', () => {
    const fam: MetricFamily = {
      name: 'qlhs_tickets',
      help: 'Tickets by flow and status',
      type: 'gauge',
      samples: [
        { labels: { status: 'Pool', flow: 'General' }, value: 3 },
        { labels: { status: 'Hardcopy', flow: 'Contract' }, value: 1 },
      ],
    }
    const lines = renderPrometheus([fam]).trimEnd().split('\n')
    expect(lines).toContain('qlhs_tickets{flow="General",status="Pool"} 3')
    expect(lines).toContain('qlhs_tickets{flow="Contract",status="Hardcopy"} 1')
  })

  it('escapes backslash, double-quote and newline in label values', () => {
    const out = renderPrometheus([
      {
        name: 'qlhs_info',
        help: 'x',
        type: 'gauge',
        samples: [{ labels: { path: 'a\\b"c\nd' }, value: 1 }],
      },
    ])
    expect(out).toContain('qlhs_info{path="a\\\\b\\"c\\nd"} 1')
  })

  it('escapes backslash and newline in HELP text', () => {
    const out = renderPrometheus([
      { name: 'qlhs_x', help: 'line\\one\ntwo', type: 'gauge', samples: [] },
    ])
    expect(out).toContain('# HELP qlhs_x line\\\\one\\ntwo')
  })

  it('omits the sample block for an empty family but keeps its headers', () => {
    const out = renderPrometheus([{ name: 'qlhs_x', help: 'x', type: 'counter', samples: [] }])
    expect(out).toBe('# HELP qlhs_x x\n# TYPE qlhs_x counter\n')
  })
})

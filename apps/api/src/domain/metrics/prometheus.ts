// Prometheus text exposition format (v0.0.4), hand-rolled so /metrics needs no
// runtime dependency. Pure: takes a snapshot of families, returns the body.

export type MetricType = 'gauge' | 'counter'

export interface MetricSample {
  labels?: Record<string, string>
  value: number
}

export interface MetricFamily {
  name: string
  help: string
  type: MetricType
  samples: MetricSample[]
}

/** HELP/TYPE text: only backslash and newline are special (a `#` line is free text). */
const escapeHelp = (s: string): string => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n')

/** Label VALUES additionally escape the double-quote that delimits them. */
const escapeLabel = (s: string): string =>
  s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')

const renderLabels = (labels?: Record<string, string>): string => {
  const resolved = labels ?? {}
  const keys = Object.keys(resolved).sort()
  if (keys.length === 0) return ''
  const body = keys.map((k) => `${k}="${escapeLabel(resolved[k] ?? '')}"`).join(',')
  return `{${body}}`
}

export function renderPrometheus(families: MetricFamily[]): string {
  let out = ''
  for (const fam of families) {
    out += `# HELP ${fam.name} ${escapeHelp(fam.help)}\n`
    out += `# TYPE ${fam.name} ${fam.type}\n`
    for (const s of fam.samples) {
      out += `${fam.name}${renderLabels(s.labels)} ${s.value}\n`
    }
  }
  return out
}

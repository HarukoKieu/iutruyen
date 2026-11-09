import { AppError } from '../../common/AppError.js'

function matchesPath(pattern: string, path: string) {
  // Greedy wildcard matching avoids catastrophic backtracking on untrusted robots.txt.
  const anchored = pattern.endsWith('$')
  if (anchored) pattern = pattern.slice(0, -1)
  let p = 0, s = 0, star = -1, retry = 0
  while (s < path.length) {
    if (p === pattern.length && !anchored) return true
    if (pattern[p] === '*') { star = p++; retry = s }
    else if (pattern[p] === path[s]) { p++; s++ }
    else if (star !== -1) { p = star + 1; s = ++retry }
    else return false
  }
  while (pattern[p] === '*') p++
  return p === pattern.length
}

// Conservative REP subset: all matching groups apply; unsupported delays fail closed.
export function assertRobotsAllowed(body: string, url: URL) {
  const lines = body.split(/\r?\n/)
  if (lines.length > 2000 || lines.some(line => line.length > 2048) || /<\/?(?:html|body|script)\b/i.test(body)) {
    throw AppError.forbidden('robots.txt không nằm trong giới hạn xử lý an toàn', 'CRAWLER_ROBOTS')
  }
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[]; delay: number }[] = []
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[], delay: 0 }
  let hasDirective = false
  for (const raw of lines) {
    const line = raw.split('#')[0].trim()
    const index = line.indexOf(':')
    if (index < 0) continue
    const key = line.slice(0, index).trim().toLowerCase()
    const value = line.slice(index + 1).trim()
    if (key === 'user-agent') {
      if (hasDirective) { groups.push(group); group = { agents: [], rules: [], delay: 0 }; hasDirective = false }
      group.agents.push(value.toLowerCase())
    } else if (group.agents.length) {
      hasDirective = true
      if (key === 'allow' || key === 'disallow') {
        if (value) group.rules.push({ allow: key === 'allow', path: value })
      }
      if (key === 'crawl-delay') group.delay = Number(value)
    }
  }
  groups.push(group)
  const matching = groups.filter(g => g.agents.some(a => a === '*' || 'iutruyencrawler'.includes(a)))
  for (const current of matching) {
    if (!Number.isFinite(current.delay) || current.delay > 2 || current.delay < 0) {
      throw AppError.forbidden('Nguồn yêu cầu crawl-delay ngoài mức hỗ trợ (2 giây)', 'CRAWLER_ROBOTS')
    }
    let best = -1
    let allowed = true
    for (const rule of current.rules) {
      let pattern: string, path: string
      try { pattern = decodeURI(rule.path); path = decodeURI(url.pathname + url.search) }
      catch { throw AppError.forbidden('robots.txt hoặc URL chứa mã hóa không hợp lệ', 'CRAWLER_ROBOTS') }
      if (matchesPath(pattern, path)) {
        const length = pattern.replace(/[*$]/g, '').length
        if (length > best || (length === best && rule.allow)) { best = length; allowed = rule.allow }
      }
    }
    if (!allowed) throw AppError.forbidden('robots.txt không cho phép crawler truy cập trang này', 'CRAWLER_ROBOTS')
  }
}

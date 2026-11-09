import { load } from 'cheerio'
const ALLOWED = new Set(['p','span','strong','b','em','i','u','s','del','blockquote','h1','h2','h3','h4','h5','h6','ul','ol','li','br','hr','div'])
/** Parse as HTML, discard active subtrees and strip all attributes from allowed formatting. */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  const $ = load(html, {}, false)
  $('script,style,iframe,object,embed,applet,form,input,button,meta,link,base,svg,math,template').remove()
  $('*').each((_index, node) => {
    if (!('tagName' in node) || !('attribs' in node)) return
    if (!ALLOWED.has(node.tagName.toLowerCase())) { $(node).replaceWith($(node).contents()); return }
    for (const name of Object.keys(node.attribs)) $(node).removeAttr(name)
  })
  return $.html().trim()
}
export function countWordsFromHtml(html: string): number {
  if (!html) return 0
  const $ = load(html, {}, false)
  $('br,hr').replaceWith(' ')
  $('p,div,li,blockquote,h1,h2,h3').append(' ')
  return $.root().text().trim().split(/\s+/u).filter(Boolean).length
}

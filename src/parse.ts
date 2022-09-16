import { readFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import yaml from 'yaml'
import { AnnotatedError } from './error.js'
import { exists } from './fs.js'

export interface TextMessage {
  type: 'text'
  content: string
}

export interface ImageMessage {
  type: 'image'
  caption: string
  url: string
}

export interface BreakMessage {
  type: 'break'
}

export type Message = BreakMessage | ImageMessage | TextMessage
export interface ParseResult {
  path: string
  filename: string

  meta: Readonly<Record<string, unknown>>
  messages: readonly Message[]
}

export const parseMarkdown: (
  path: string,
) => Promise<ParseResult> = async path => {
  const fileExists = await exists(path)
  if (!fileExists) throw new Error(`"${path}" does not exist`)

  const text = await readFile(path, 'utf8')
  const split = text.split('---')

  const [frontmatter, ...chunks] = split
    .map(line => line.trim())
    .filter(line => line !== '')

  if (frontmatter === undefined) {
    throw new AnnotatedError(
      'Failed to parse template!',
      'Frontmatter is missing!',
      { file: path },
    )
  }

  const meta = yaml.parse(frontmatter) as Record<string, unknown>
  const messages = chunks
    .map(line => parseBreakMessage(path, line))
    .map(line => parseImageMessage(path, line))
    .map(line => translateBulletPoints(path, line))
    .map(line => parseTextLine(path, line))

  const filename = parse(path).base
  return { path, filename, meta, messages }
}

type ParserFn = (path: string, line: Message | string) => Message | string
type FinalParserFn = (...parameters: Parameters<ParserFn>) => Message

const parseBreakMessage: ParserFn = (_, line) => {
  if (typeof line !== 'string') return line
  if (line === '::break') {
    return { type: 'break' }
  }

  return line
}

const IMAGE_RX = /^!\[(?<caption>.*)]\((?<url>.+)\)$/
const parseImageMessage: ParserFn = (path, line) => {
  if (typeof line !== 'string') return line

  const matches = IMAGE_RX.exec(line)
  if (matches === null) return line
  const groups = matches.groups ?? {}

  const caption = groups.caption!
  const url = groups.url!

  const isHttp = url.toLowerCase().startsWith('http://')
  const isHttps = url.toLowerCase().startsWith('https://')
  if (isHttp || isHttps) {
    return { type: 'image', caption, url }
  }

  const { dir } = parse(path)
  const imagePath = join(dir, url)

  return { type: 'image', caption, url: imagePath }
}

const BULLET_RX = /^[*-] /gm
const translateBulletPoints: ParserFn = (_, line) => {
  if (typeof line !== 'string') return line
  return line.replace(BULLET_RX, '• ')
}

const parseTextLine: FinalParserFn = (_, line) => {
  if (typeof line !== 'string') return line
  return { type: 'text', content: line }
}

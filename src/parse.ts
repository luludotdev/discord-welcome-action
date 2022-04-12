import { readFile } from 'fs/promises'
import { parse } from 'path'
import yaml from 'yaml'
import { exists } from './fs'

export interface TextMessage {
  type: 'text'
  content: string
}

export interface ImageMessage {
  type: 'image'
  caption: string
  url: string
}

export type Message = TextMessage | ImageMessage
export interface ParseResult {
  path: string
  filename: string

  meta: Readonly<Record<string, unknown>>
  messages: readonly Message[]
}

export const parseMarkdown: (
  path: string
) => Promise<ParseResult> = async path => {
  const fileExists = await exists(path)
  if (!fileExists) throw new Error(`"${path}" does not exist`)

  const text = await readFile(path, 'utf8')
  const split = text.split('---')

  const [frontmatter, ...chunks] = split
    .map(line => line.trim())
    .filter(line => line !== '')

  const meta = yaml.parse(frontmatter) as Record<string, unknown>
  const messages = chunks
    .map(line => parseImageMessage(line))
    .map(line => translateBulletPoints(line))
    .map(line => parseTextLine(line))

  const filename = parse(path).base
  return { path, filename, meta, messages }
}

type ParserFn = (line: string | Message) => string | Message
type FinalParserFn = (...parameters: Parameters<ParserFn>) => Message

const IMAGE_RX = /^!\[(.*)]\((.+)\)$/
const parseImageMessage: ParserFn = line => {
  if (typeof line !== 'string') return line

  const matches = IMAGE_RX.exec(line)
  if (matches === null) return line

  const [, caption, url] = matches
  return { type: 'image', caption, url }
}

const BULLET_RX = /^[*-] /gm
const translateBulletPoints: ParserFn = line => {
  if (typeof line !== 'string') return line
  return line.replace(BULLET_RX, '• ')
}

const parseTextLine: FinalParserFn = line => {
  if (typeof line !== 'string') return line
  return { type: 'text', content: line }
}

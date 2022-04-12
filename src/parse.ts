import { readFile } from 'fs/promises'
import { parse } from 'path'
import yaml from 'yaml'
import { exists } from './fs'

interface MessageCommon {
  path: string
  filename: string
}

export interface TextMessage extends MessageCommon {
  type: 'text'
  content: string
}

export interface ImageMessage extends MessageCommon {
  type: 'image'
  caption: string
  url: string
}

export type Message = TextMessage | ImageMessage
export interface ParseResult {
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

  const common: MessageCommon = {
    path,
    filename: parse(path).base,
  }

  const meta = yaml.parse(frontmatter) as Record<string, unknown>
  const messages = chunks
    .map(line => parseImageMessage(common, line))
    .map(line => translateBulletPoints(common, line))
    .map(line => parseTextLine(common, line))

  return { meta, messages }
}

type ParserFn = (
  common: MessageCommon,
  line: string | Message
) => string | Message
type FinalParserFn = (...parameters: Parameters<ParserFn>) => Message

const IMAGE_RX = /^!\[(.*)]\((.+)\)$/
const parseImageMessage: ParserFn = (common, line) => {
  if (typeof line !== 'string') return line

  const matches = IMAGE_RX.exec(line)
  if (matches === null) return line

  const [, caption, url] = matches
  return { ...common, type: 'image', caption, url }
}

const BULLET_RX = /^[*-] /gm
const translateBulletPoints: ParserFn = (_, line) => {
  if (typeof line !== 'string') return line
  return line.replace(BULLET_RX, '• ')
}

const parseTextLine: FinalParserFn = (common, line) => {
  if (typeof line !== 'string') return line
  return { ...common, type: 'text', content: line }
}

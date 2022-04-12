import { type PathLike } from 'fs'

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
  path: PathLike
) => Promise<ParseResult> = async path => {
  // TODO
  return { meta: {}, messages: [] }
}

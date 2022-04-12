import { type Message } from './parse'

export interface ChannelData {
  channelID: string
  messages: readonly Message[]

  senderName?: string
  senderImage?: string
}

export const sendMessages: (...data: ChannelData[]) => Promise<void> = async (
  ...data
) => {
  // TODO
}

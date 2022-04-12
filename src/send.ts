import {
  Client,
  Intents,
  MessageAttachment,
  TextChannel,
  WebhookClient,
} from 'discord.js'
import { parse } from 'path'
import { AnnotatedError } from './error'
import { type Message } from './parse'

export interface ChannelData {
  path: string
  filename: string

  channelID: string
  messages: readonly Message[]

  senderName?: string
  senderImage?: string
}

export const sendMessages: (
  token: string,
  ...data: ChannelData[]
) => Promise<void> = async (token, ...data) => {
  const client = new Client({
    intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_WEBHOOKS],
  })

  const login: () => Promise<void> = async () =>
    new Promise((resolve, reject) => {
      client.on('ready', () => resolve())

      try {
        void client.login(token)
      } catch (error: unknown) {
        reject(error)
      }
    })

  await login()

  try {
    const webhookData = await resolveWebhooks(client, ...data)
    try {
      /* eslint-disable no-await-in-loop */
      for (const entry of webhookData) {
        await sendEntry(entry)

        const { channel, viewChannelPerm } = entry
        if (viewChannelPerm !== false) {
          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              VIEW_CHANNEL: viewChannelPerm,
            }
          )
        }
      }
      /* eslint-enable no-await-in-loop */
    } finally {
      for (const { webhook } of webhookData) {
        webhook.destroy()
      }
    }
  } finally {
    client.destroy()
  }
}

interface WebhookData extends ChannelData {
  webhook: WebhookClient
  channel: TextChannel
  senderName: string
  viewChannelPerm: boolean | undefined | undefined
}

const resolveWebhooks: (
  client: Client,
  ...data: ChannelData[]
) => Promise<WebhookData[]> = async (client, ...data) => {
  const hookData: WebhookData[] = []

  /* eslint-disable no-await-in-loop */
  for (const entry of data) {
    const { channelID, path: file } = entry
    const channel = await client.channels.fetch(channelID)

    if (channel === null) {
      throw new AnnotatedError(
        'Failed to resolve channel!',
        `Channel ID \`${channelID}\` could not be found!`,
        { file }
      )
    }

    if (!(channel instanceof TextChannel)) {
      throw new AnnotatedError(
        'Failed to resolve channel!',
        `Channel ID \`${channelID}\` is not a text channel!`,
        { file }
      )
    }

    const isPublicChannel = channel
      .permissionsFor(channel.guild.roles.everyone)
      ?.has('SEND_MESSAGES')

    if (isPublicChannel) {
      throw new AnnotatedError(
        'Channel permissions are too open!',
        `Channel ID \`${channelID}\` has send messages on for @everyone`,
        { file }
      )
    }

    const webhooks = await channel.fetchWebhooks()
    const rawHook = webhooks.first() ?? (await channel.createWebhook('Welcome'))

    const senderName = entry.senderName ?? channel.guild.name
    const senderImage =
      entry.senderImage ??
      channel.guild.iconURL({
        format: 'png',
        dynamic: false,
        size: 2048,
      }) ??
      undefined

    const overwrites = channel.permissionOverwrites.cache.get(channel.guild.id)!
    const allowed = overwrites.allow.has('VIEW_CHANNEL')
    const denied = overwrites.deny.has('VIEW_CHANNEL')
    const viewChannelPerm = !allowed && !denied ? undefined : allowed

    const webhook = new WebhookClient({ id: rawHook.id, token: rawHook.token! })
    hookData.push({
      ...entry,
      webhook,
      channel,
      senderName,
      senderImage,
      viewChannelPerm,
    })
  }
  /* eslint-enable no-await-in-loop */

  /* eslint-disable no-await-in-loop */
  for (const { channel, viewChannelPerm } of hookData) {
    if (viewChannelPerm !== false) {
      await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
        VIEW_CHANNEL: false,
      })
    }

    const messages = await channel.messages.fetch({ limit: 100 })
    for (const message of messages.values()) {
      await message.delete()
    }
  }
  /* eslint-enable no-await-in-loop */

  return hookData
}

const sendEntry: (entry: WebhookData) => Promise<void> = async ({
  webhook,
  messages,
  senderName,
  senderImage,
}) => {
  for (const message of messages) {
    /* eslint-disable no-await-in-loop */
    switch (message.type) {
      case 'image': {
        const { ext } = parse(message.url)
        const image = new MessageAttachment(
          message.url,
          `${message.caption}${ext}`
        )

        await webhook.send({
          files: [image],
          username: senderName,
          avatarURL: senderImage,
        })

        break
      }

      case 'text': {
        await webhook.send({
          content: message.content,
          username: senderName,
          avatarURL: senderImage,
        })

        break
      }

      default: {
        // @ts-expect-error usage of `never` type
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`unhandled message type: ${message.type}`)
      }
    }
    /* eslint-enable no-await-in-loop */
  }
}

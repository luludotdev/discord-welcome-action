import * as core from '@actions/core'
import {
  AttachmentBuilder,
  Client,
  EmbedBuilder,
  IntentsBitField as Intents,
  TextChannel,
  WebhookClient,
} from 'discord.js'
import { parse } from 'node:path'
import { AnnotatedError } from './error.js'
import { type Message } from './parse.js'
import { splitMessage } from './split.js'

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
    intents: [Intents.Flags.Guilds, Intents.Flags.GuildWebhooks],
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

  const tag = client.user?.tag ?? 'Unknown#0000'
  core.info(`Logged in as ${tag}`)

  try {
    const webhookData = await resolveWebhooks(client, ...data)
    try {
      /* eslint-disable no-await-in-loop */
      for (const entry of webhookData) {
        const count = await sendEntry(entry)

        const { channel, viewChannelPerm } = entry
        if (viewChannelPerm !== false) {
          await channel.permissionOverwrites.edit(
            channel.guild.roles.everyone,
            {
              ViewChannel: viewChannelPerm,
            }
          )
        }

        core.info(
          `Sent ${count} message(s) to #${channel.name} in ${channel.guild.name}`
        )
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
  // eslint-disable-next-line @typescript-eslint/ban-types
  viewChannelPerm: boolean | null | undefined
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
      ?.has('SendMessages')

    if (isPublicChannel) {
      throw new AnnotatedError(
        'Channel permissions are too open!',
        `Channel ID \`${channelID}\` has send messages on for @everyone`,
        { file }
      )
    }

    const webhooks = await channel.fetchWebhooks()
    const rawHook =
      webhooks.first() ?? (await channel.createWebhook({ name: 'Welcome' }))

    const senderName = entry.senderName ?? channel.guild.name
    const senderImage =
      entry.senderImage ??
      channel.guild.iconURL({
        extension: 'png',
        forceStatic: true,
        size: 2048,
      }) ??
      undefined

    const overwrites = channel.permissionOverwrites.cache.get(channel.guild.id)!
    const allowed = overwrites.allow.has('ViewChannel')
    const denied = overwrites.deny.has('ViewChannel')
    const viewChannelPerm = !allowed && !denied ? null : allowed

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
        ViewChannel: false,
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

const sendEntry: (entry: WebhookData) => Promise<number> = async ({
  path: file,
  webhook,
  messages,
  senderName,
  senderImage,
}) => {
  let count = 0
  for (const message of messages) {
    /* eslint-disable no-await-in-loop */
    switch (message.type) {
      case 'image': {
        const { ext } = parse(message.url)
        const image = new AttachmentBuilder(message.url, {
          name: `${message.caption}${ext}`,
        })

        await webhook.send({
          files: [image],
          username: senderName,
          avatarURL: senderImage,
        })

        count += 1
        break
      }

      case 'text': {
        const split = splitMessage(message.content, { maxLength: 1950 })
        if (split.length > 1) {
          core.warning('A message was split due to max length constraints', {
            file,
          })
        }

        for (const chunk of split) {
          await webhook.send({
            content: chunk,
            username: senderName,
            avatarURL: senderImage,
          })
        }

        break
      }

      case 'break': {
        const embed = new EmbedBuilder({ description: '-' })

        await webhook.send({
          embeds: [embed],
          username: senderName,
          avatarURL: senderImage,
          flags: ['SuppressEmbeds'],
        })

        break
      }

      default: {
        // @ts-expect-error usage of `never` type

        throw new Error(`unhandled message type: ${message.type}`)
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  return count
}

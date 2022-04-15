import * as core from '@actions/core'
import { readdir as readDir } from 'fs/promises'
import { join as joinPath } from 'path'
import { AnnotatedError } from './error'
import { isDirectory } from './fs'
import { parseMarkdown } from './parse'
import { type ChannelData, sendMessages } from './send'

const run = async () => {
  const token = core.getInput('discord-token')
  const contentPath = core.getInput('content')

  const isDir = await isDirectory(contentPath)
  if (!isDir) {
    core.setFailed(`Input 'content' must be a directory`)
    return
  }

  const paths = await readDir(contentPath)
  if (paths.length === 0) {
    core.warning('No template files were found in the specified directory')
    return
  }

  core.startGroup('Parse Step')
  const jobs = paths
    .filter(file => file.toLowerCase().endsWith('.md'))
    .map(file => joinPath(contentPath, file))
    .map(async path => parseMarkdown(path))

  const files = await Promise.all(jobs)
  const data = files.map(({ path, filename, meta, messages }) => {
    const { senderName, senderImage, channel: channelID } = meta

    if (typeof channelID === 'undefined' || channelID === null) {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `channel` is missing!',
        { file: path }
      )
    }

    if (typeof channelID !== 'string') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `channel` must be a string!',
        { file: path }
      )
    }

    if (typeof senderName !== 'string' && typeof senderName !== 'undefined') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `senderName` must be a string!',
        { file: path }
      )
    }

    if (typeof senderImage !== 'string' && typeof senderImage !== 'undefined') {
      throw new AnnotatedError(
        'Failed to parse template!',
        'Frontmatter key `senderImage` must be a string!',
        { file: path }
      )
    }

    const data: ChannelData = {
      path,
      filename,
      channelID,
      messages,
      senderName,
      senderImage,
    }

    core.info(`Successfully parsed \`${path}\``)
    return data
  })

  core.endGroup()
  core.startGroup('Send Step')

  await sendMessages(token, ...data)
  core.endGroup()
}

void run().catch((error: unknown) => {
  if (error instanceof AnnotatedError) {
    core.error(error.annotation, error.properties)
    core.setFailed(error.message)

    return
  }

  if (typeof error === 'string' || error instanceof Error) core.setFailed(error)
  else core.setFailed('An unknown error occurred!')
})

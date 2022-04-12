import core from '@actions/core'
import { isDirectory, isDirEmpty } from './fs'

const run = async () => {
  const token = core.getInput('token')
  const contentPath = core.getInput('content')

  const isDir = await isDirectory(contentPath)
  if (!isDir) {
    core.setFailed(`Input 'content' must be a directory`)
    return
  }

  const isEmpty = await isDirEmpty(contentPath)
  if (isEmpty) {
    core.warning('No template files were found in the specified directory')
    return
  }

  // TODO
  void 0
}

void run().catch(error => core.setFailed(error))

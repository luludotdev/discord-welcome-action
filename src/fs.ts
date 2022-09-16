import type { PathLike } from 'node:fs'
import { lstat, stat } from 'node:fs/promises'

export const exists: (path: PathLike) => Promise<boolean> = async path => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export const isDirectory: (path: PathLike) => Promise<boolean> = async path => {
  try {
    const stats = await lstat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

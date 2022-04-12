import { type PathLike } from 'fs'
import { lstat, stat } from 'fs/promises'

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

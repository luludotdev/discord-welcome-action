/**
 * Verifies the provided data is a string, otherwise throws provided error
 * @param data The string resolvable to resolve
 * @param error The Error constructor to instantiate [default: `Error`]
 * @param errorMessage The error message to throw with [default: "Expected string, got <data> instead."]
 * @param allowEmpty Whether an empty string should be allowed [default: true]
 */
export const verifyString: (
  data: unknown,
  error?: ErrorConstructor,
  errorMessage?: string,
  allowEmpty?: boolean
) => string = (
  data,
  error = Error,
  errorMessage = `Expected a string, got ${data} instead.`,
  allowEmpty = true
) => {
  if (typeof data !== 'string') throw new error(errorMessage)
  if (!allowEmpty && data.length === 0) throw new error(errorMessage)

  return data
}

export interface SplitOptions {
  /**
   * Maximum character length per message piece [default: 2000]
   */
  maxLength?: number

  /**
   * Character(s) or Regex(es) to split the message with,
   * an array can be used to split multiple times [default: '\n']
   */
  char?: string | string[] | RegExp | RegExp[]

  /**
   * Text to prepend to every piece except the first [default: ""]
   */
  prepend?: string

  /**
   * Text to append to every piece except the last [default: ""]
   */
  append?: string
}

/**
 * Splits a string into multiple chunks at a designated character that do not exceed a specific length
 * @param text Content to split
 * @param options Options controlling the behavior of the split
 */
export const splitMessage: (
  text: string,
  options?: SplitOptions
) => string[] = (
  text,
  { maxLength = 2000, char = '\n', prepend = '', append = '' } = {}
) => {
  const txt = verifyString(text)
  if (txt.length <= maxLength) return [txt]

  let messages = [txt]
  if (Array.isArray(char)) {
    while (
      char.length > 0 &&
      messages.some(element => element.length > maxLength)
    ) {
      const currentChar = char.shift()!
      const split =
        currentChar instanceof RegExp
          ? messages.flatMap(chunk => chunk.match(currentChar))
          : messages.flatMap(chunk => chunk.split(currentChar))

      messages = split.filter(
        (chunk): chunk is string => typeof chunk === 'string'
      )
    }
  } else {
    messages = txt.split(char)
  }

  if (messages.some(element => element.length > maxLength)) {
    throw new RangeError('SPLIT_MAX_LEN')
  }

  messages.map((line, idx) => {
    const isFirst = idx === 0
    const isLast = idx - 1 === messages.length

    return isFirst
      ? `${line}${append}`
      : isLast
      ? `${prepend}${line}`
      : `${prepend}${line}${append}`
  })

  return messages
}

const LIKE_LITERAL = /[\\%_]/gu
const GLOB_LITERAL: Readonly<Record<string, string>> = {
  "*": "[*]",
  "?": "[?]",
  "[": "[[]",
  "]": "[]]",
}

export function escapeLikeLiteral(value: string): string {
  return value.replace(LIKE_LITERAL, (character) => `\\${character}`)
}

/** Translate SQL pattern wildcards while treating Unix glob syntax literally. */
export function likeToGlob(pattern: string): string {
  let result = ""
  let escaped = false
  for (const character of pattern) {
    if (escaped) {
      result += GLOB_LITERAL[character] ?? character
      escaped = false
    } else if (character === "\\") {
      escaped = true
    } else if (character === "%") {
      result += "*"
    } else if (character === "_") {
      result += "?"
    } else {
      result += GLOB_LITERAL[character] ?? character
    }
  }
  if (escaped) {
    result += "\\"
  }
  return result
}

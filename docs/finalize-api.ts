// TypeDoc's sidebar serializer omits the newline required by the repo formatter.
const sidebar = new URL("./api/typedoc-sidebar.json", import.meta.url)
await Bun.write(sidebar, `${(await Bun.file(sidebar).text()).trimEnd()}\n`)

// TypeDoc may leave spaces after expanded signature parameters in code blocks.
const trailingWhitespace = /[\t ]+$/gm
const api = new URL("./api/", import.meta.url)
for await (const relative of new Bun.Glob("**/*.md").scan({
  cwd: api.pathname,
})) {
  const file = new URL(relative, api)
  const source = await Bun.file(file).text()
  const normalized = source.replace(trailingWhitespace, "")
  if (source !== normalized) {
    await Bun.write(file, normalized)
  }
}

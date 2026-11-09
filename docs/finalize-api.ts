// TypeDoc's sidebar serializer omits the newline required by the repo formatter.
const sidebar = new URL("./api/typedoc-sidebar.json", import.meta.url)
await Bun.write(sidebar, `${(await Bun.file(sidebar).text()).trimEnd()}\n`)

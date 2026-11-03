import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import autoprefixer from 'autoprefixer'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { transformWithEsbuild, type Plugin } from 'vite'

const PUBLIC_URL = '/zeus.css'
const WATCHED = /[\\/](src[\\/].+\.(tsx?|jsx?|css)|index\.html|tailwind\.config\.js)$/

export function staticCss(root: string): Plugin {
  const source = path.resolve(root, 'src/index.css')
  const config = path.resolve(root, 'tailwind.config.js')
  const outFile = path.resolve(root, 'public', PUBLIC_URL.slice(1))
  let hash = ''
  let minify = false
  let queue: Promise<void> = Promise.resolve()

  async function compile(): Promise<string> {
    const input = await readFile(source, 'utf8')
    const result = await postcss([tailwindcss({ config }), autoprefixer()]).process(input, { from: source, to: outFile })
    if (!minify) return result.css
    return (await transformWithEsbuild(result.css, 'zeus.css', { loader: 'css', minify: true })).code
  }

  function regenerate(): Promise<boolean> {
    const run = queue.then(async () => {
      const css = await compile()
      const next = createHash('sha256').update(css).digest('hex').slice(0, 10)
      if (next === hash) return false
      await mkdir(path.dirname(outFile), { recursive: true })
      await writeFile(outFile, css)
      hash = next
      return true
    })
    queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return {
    name: 'zeus-static-css',
    configResolved(resolved) {
      minify = resolved.command === 'build'
    },
    async buildStart() {
      await regenerate()
    },
    async configureServer(server) {
      await regenerate()
      let timer: ReturnType<typeof setTimeout> | undefined
      const onChange = (file: string) => {
        if (!WATCHED.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          regenerate()
            .then((changed) => {
              if (!changed) return
              server.ws.send({
                type: 'update',
                updates: [{ type: 'css-update', path: PUBLIC_URL, acceptedPath: PUBLIC_URL, timestamp: Date.now() }],
              })
            })
            .catch((error: unknown) => {
              server.config.logger.error(`[zeus-static-css] ${error instanceof Error ? error.message : String(error)}`)
            })
        }, 80)
      }
      server.watcher.on('change', onChange)
      server.watcher.on('add', onChange)
      server.watcher.on('unlink', onChange)
    },
    transformIndexHtml(html) {
      return html.replace(`href="${PUBLIC_URL}"`, `href="${PUBLIC_URL}?v=${hash}"`)
    },
  }
}

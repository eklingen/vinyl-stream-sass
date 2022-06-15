// Small vinyl-stream wrapper - aka Gulp plugin - for sass (dart-sass).
// Fully supports source maps.
//
// For more speed (faster then libsassc in most cases!), it tries to use a binary.
// If it can't find one, or it doesn't work, it will try the `sass` javascript package.
// You can disable this behavior by setting `options.tryBinary: false`.
// Note: Due to async overhead, this might be slower on small files.

const { chmod } = require('fs').promises
const { basename, dirname, extname, join, relative } = require('path')
const { exec } = require('child_process')
const { platform, arch } = require('os')
const { Transform, Readable } = require('stream')

const sassBinary = join(module.path, `/vendor/sass/${platform()}-${arch()}/sass`)

const DEFAULT_OPTIONS = {
  tryBinary: true,

  sass: {
    outputStyle: 'compressed', // or 'extended'
    charset: true,
    errorCss: true,
    sourceMap: true,
    sourceMapContents: true,
    includePaths: []
  }
}

async function runBinary (buffer, binary = '', args = [], maxBuffer = 16 * 1024 * 1024, encoding = null) {
  if (!binary) {
    return
  }

  return new Promise((resolve, reject) => {
    try {
      chmod(binary, 0o744)

      const child = exec(`${binary} ${args.join(' ')}`, { encoding, maxBuffer, windowsHide: true }, (err, stdout, stderr) => err ? reject(stderr) : resolve(stdout))
      child.stdin.on('error', error => console.log('Could not pipe to executable. Try to `chmod +x` it.') && console.log(error))

      const stdin = new Readable({ encoding, maxBuffer })
      stdin.push(buffer)
      stdin.push(null)
      stdin.pipe(child.stdin)
    } catch (error) {
      reject(error)
    }
  })
}

function binarySassArgs (options = {}) {
  const args = ['--stdin']

  options.includePaths.forEach(path => args.push(`--load-path="${path}"`))

  args.push(`--style="${options.outputStyle}"`)
  args.push(options.charset ? '--charset' : '--no-charset')
  args.push(options.errorCss ? '--error-css' : '--no-error-css')

  if (options.sourceMap) {
    args.push('--source-map')
    args.push('--embed-source-map')
    args.push('--source-map-urls="absolute"')
  }

  if (options.sourceMapContents) {
    args.push('--embed-sources')
  }

  return args
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function dartSassWrapper (options = {}) {
  const { SourceMapConsumer, SourceMapGenerator } = require('source-map')
  const { renderSync } = require('sass')

  options = { ...DEFAULT_OPTIONS, ...options }
  options.sass = { ...DEFAULT_OPTIONS.sass, ...options.sass }
  options.sass.includePaths = [...DEFAULT_OPTIONS.sass.includePaths, ...options.sass.includePaths]

  async function transform (file, encoding, callback) {
    if (basename(file.path).indexOf('_') === 0) {
      return callback() // Sass convention says files beginning with an underscore should be used via @import only, so remove the file from the stream
    }

    if (!file.contents.length) {
      file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')
      return callback(null, file)
    }

    options.sass.includePaths.unshift(dirname(file.path))

    let result = {}

    try {
      if (options.tryBinary) {
        let data = (await runBinary(file.contents, sassBinary, [...binarySassArgs({ ...options.sass })]))
        data = data.toString('utf-8')

        if (data) {
          const index = data.search(/\/[/*][#@]\s+sourceMappingURL=data:(.*)/i)

          if (~index) {
            const [,, inner] = /(\/\*+[\s\S]*?sourceMappingURL\s*=[\s\S]*?,([\s\S]*?)(\*\/[\s\s]*)$)/i.exec(data)

            result.css = Buffer.from(data.substr(0, index).trimEnd())
            result.map = Buffer.from(decodeURIComponent(inner))
          } else {
            result.css = Buffer.from(data)
          }
        }
      }
    } catch (error) {
      error.relativePath = relative(process.cwd(), (error.file === 'stdin' ? file.path : error.file) || file.path)
      error.message = `Error in ${error.relativePath}:\n${error.message}`
      error.formatted = `\x1b[31m${error.message}\x1b[0m`

      return callback(new Error(error))
    }

    if (!result.css) {
      options.sass = { ...options.sass, data: file.contents.toString(), file: file.path, outFile: options.sass.sourceMap ? 'main.css' : false }

      try {
        result = renderSync(options.sass)
      } catch (error) {
        return callback(error)
      }
    }

    if (!result.css) {
      return callback(new Error('Stylesheet not generated.'))
    }

    if (result.map) {
      const sourceMap = JSON.parse(result.map.toString('utf8'))

      sourceMap.sources = sourceMap.sources.map((source, index) => ~source.indexOf('file://') ? relative(file.base, source.substr(7)) : source) // Convert absolute to relative paths
      sourceMap.file = join(dirname(file.relative), basename(file.relative, extname(file.relative)) + '.css')

      if (file.sourceMap && (typeof file.sourceMap === 'string' || file.sourceMap instanceof String)) {
        file.sourceMap = JSON.parse(file.sourceMap)
      }

      if (file.sourceMap && file.sourceMap.mappings !== '') {
        // TODO: There is probably a much better way to merge 2 sourcemaps. https://github.com/mozilla/source-map
        const consumer1 = await new SourceMapConsumer(sourceMap)
        const consumer2 = await new SourceMapConsumer(file.sourceMap)
        const generator = SourceMapGenerator.fromSourceMap(consumer1)

        generator.applySourceMap(consumer2)
        file.sourceMap = JSON.parse(generator.toString())

        consumer1.destroy()
        consumer2.destroy()
      } else {
        file.sourceMap = sourceMap
      }
    }

    file.contents = Buffer.from(result.css.toString('utf8').replace(`\n\n/*# sourceMappingURL=${basename(file.path, extname(file.path))}.css.map */`, ''))
    file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')

    return callback(null, file)
  }

  return new Transform({ transform, readableObjectMode: true, writableObjectMode: true })
}

module.exports = dartSassWrapper

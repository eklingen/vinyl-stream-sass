// Small vinyl-stream wrapper - aka Gulp plugin - for sass (dart-sass).
// Fully supports source maps.
//
// For more speed (faster then libsassc in most cases!), it tries to use a binary.
// If it can't find one, or it doesn't work, it will try the `sass` javascript package.
// You can disable this behavior by setting `options.tryBinary: false`.
// Note: Due to async overhead, this might be slower on small files.

const { basename, dirname, extname, join, relative } = require('path')
const { exec } = require('child_process')
const { platform, arch } = require('os')
const { Transform, Readable } = require('stream')

const sassBinary = join(module.path, `/vendor/sass-1.23.7/${platform()}-${arch()}/sass${platform() === 'win32' ? '.bat' : ''}`)

const DEFAULT_OPTIONS = {
  tryBinary: true,

  sass: {
    outputStyleCompressed: false,
    emitCharset: true,
    emitErrorCss: true,
    emitSourceMap: true
  }
}

async function runBinary (buffer, binary = '', args = [], maxBuffer = 8 * 1024 * 1024, encoding = null) {
  if (!binary) {
    return
  }

  return new Promise((resolve, reject) => {
    try {
      const child = exec(`${binary} ${args.join(' ')}`, { encoding, maxBuffer, windowsHide: true }, (err, stdout, stderr) => resolve(err ? stderr : stdout))
      child.stdin.on('error', error => console.log('Could not pipe to executable. Try to `chmod +x` it.') && console.log(error))

      const stdin = new Readable({ encoding, maxBuffer })
      stdin.push(buffer)
      stdin.push(null)
      stdin.pipe(child.stdin)
    } catch (error) {
      console.log('ERROR', error)
      reject(error)
    }
  })
}

function binarySassArgs (options = {}) {
  options = { ...DEFAULT_OPTIONS.sass, ...options }

  const args = ['--stdin']

  options.includePaths.forEach(path => args.push(`--load-path="${path}"`))

  if (options.outputStyleCompressed) {
    args.push('--style="compressed"')
  } else {
    args.push('--style="expanded"')
  }

  if (options.emitCharset) {
    args.push('--charset')
  } else {
    args.push('--no-charset')
  }

  if (options.emitErrorCss) {
    args.push('--error-css')
  } else {
    args.push('--no-error-css')
  }

  if (options.emitSourceMap) {
    args.push('--source-map')
    args.push('--embed-source-map')
    args.push('--embed-sources')
    args.push('--source-map-urls="absolute"')
  } else {
    args.push('--no-source-map')
  }

  return args
}

function dartSassWrapper (options = {}) {
  const { renderSync } = require('sass')
  const applySourceMap = require('vinyl-sourcemaps-apply')

  options = { ...DEFAULT_OPTIONS, ...options }

  async function transform (file, encoding, callback) {
    if (basename(file.path).indexOf('_') === 0) {
      return callback() // Sass convention says files beginning with an underscore should be used via @import only, so remove the file from the stream
    }

    if (!file.contents.length) {
      file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')
      return callback(null, file)
    }

    options = ({ ...options, ...{ data: file.contents.toString(), file: file.path } })
    options.includePaths = (typeof options.includePaths === 'string') ? [options.includePaths] : []
    options.includePaths.unshift(dirname(file.path))

    let result

    try {
      if (options.tryBinary) {
        const data = await runBinary(file.contents, sassBinary, [...binarySassArgs({ ...options.sass, includePaths: options.includePaths })]).toString('utf8')

        if (data) {
          const index = data.search(/\/[/*][#@]\s+sourceMappingURL=data:(.*)/i)
          const result = {}

          if (~index) {
            const [,, inner] = /(\/\*+[\s\S]*?sourceMappingURL\s*=[\s\S]*?,([\s\S]*?)\*\/)/i.exec(data)

            result.css = Buffer.from(data.substr(0, index))
            result.map = Buffer.from(decodeURIComponent(inner))
          } else {
            result.css = Buffer.from(data)
          }
        }
      }

      if (!result) {
        if (file.sourceMap) {
          options.sourceMap = file.path
          options.omitSourceMapUrl = true
          options.sourceMapContents = true
        }

        result = renderSync(options)
      }

      if (!result) {
        return callback(new Error('Sass returned nothing.'))
      }
    } catch (error) {
      error.relativePath = relative(process.cwd(), (error.file === 'stdin' ? file.path : error.file) || file.path)
      error.message = `Error in ${error.relativePath}:\n${error.message}`
      error.formatted = `\x1b[31m${error.message}\x1b[0m`

      return callback(new Error(error))
    }

    if (result.map) {
      const sassMap = JSON.parse(result.map.toString())

      sassMap.sources = sassMap.sources.map((source, index) => ~source.indexOf('file://') ? relative(file.base, source.substr(7)) : source) // Convert absolute to relative paths
      sassMap.file = join(dirname(file.relative), basename(file.relative, extname(file.relative)) + '.css')

      applySourceMap(file, sassMap)
    }

    file.contents = result.css
    file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')

    return callback(null, file)
  }

  return new Transform({ transform, readableObjectMode: true, writableObjectMode: true })
}

module.exports = dartSassWrapper

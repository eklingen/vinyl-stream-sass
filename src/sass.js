// Small vinyl-stream wrapper - aka Gulp plugin - for sass (dart-sass).
// Fully supports source maps.
//
// Has an experimental hyperfast path. To use it:
// - Check the latest dart-sass releases on: https://github.com/sass/dart-sass/releases
// - Add the desired version for your OS as an optional dependency to your package.json:
//     "optionalDependencies": { "binaries__dart-sass": "https://github.com/sass/dart-sass/releases/download/1.23.3/dart-sass-1.23.3-macos-x64.tar.gz" }
// - The run `yarn` or `npm` to install it. This package will try to use the binary if possible, unless `options.tryBinary` is false.

const { basename, dirname, extname, join, relative } = require('path')
const { execSync } = require('child_process')
const { existsSync } = require('fs')
const { Transform } = require('stream')

const BINARY_PATH = './node_modules/binaries__dart-sass/sass'
const DEFAULT_OPTIONS = {
  experimentalTryBinary: true
}

function runBinarySass (options) {
  const dir = dirname(relative(process.cwd(), options.file))
  const data = execSync(`${BINARY_PATH} --stdin --load-path="${dir}" --charset --embed-source-map --embed-sources --source-map-urls="absolute" --error-css`, { env: process.env, cwd: process.cwd(), input: options.data, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }).toString()
  const index = data.search(/\/[/*][#@]\s+sourceMappingURL=data:(.*)/i)
  const result = {}

  if (~index) {
    const [,, inner] = /(\/\*+[\s\S]*?sourceMappingURL\s*=[\s\S]*?,([\s\S]*?)\*\/)/i.exec(data)

    result.css = Buffer.from(data.substr(0, index))
    result.map = Buffer.from(decodeURIComponent(inner))
  } else {
    result.css = Buffer.from(data)
  }

  return result
}

function dartSassWrapper (options = {}) {
  const { renderSync } = require('sass')
  const applySourceMap = require('vinyl-sourcemaps-apply')

  options = { ...DEFAULT_OPTIONS, ...options }
  options.experimentalTryBinary = options.experimentalTryBinary && existsSync(BINARY_PATH)

  function transform (file, encoding, callback) {
    if (basename(file.path).indexOf('_') === 0) {
      return callback() // Sass convention says files beginning with an underscore should be used via @import only, so remove the file from the stream
    }

    if (!file.contents.length) {
      file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')
      return callback(null, file)
    }

    options = ({ ...options, ...{ data: file.contents.toString(), file: file.path }})
    options.includePaths = (typeof options.includePaths === 'string') ? [options.includePaths] : []
    options.includePaths.unshift(dirname(file.path))

    let result

    try {
      if (options.experimentalTryBinary) {
        result = runBinarySass(options)
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

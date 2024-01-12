// Small vinyl-stream wrapper - aka Gulp plugin - for sass (dart-sass, or sass-embedded to be more specific).
// Fully supports source maps.

const { basename, dirname, extname, join, relative } = require('path')
const { Transform } = require('stream')

const DEFAULT_OPTIONS = {
  sass: {
    outputStyle: 'compressed', // or 'expanded'
    charset: true,
    // errorCss: true, // NOTE: NO LONGER RELEVANT
    sourceMap: true,
    sourceMapIncludeSources: true, // NOTE: NEW
    // sourceMapContents: true, // NOTE: NO LONGER RELEVANT
    includePaths: [process.cwd() + '/node_modules'],
    loadPaths: [process.cwd() + '/node_modules'],
    functions: {},
    importers: [],
    alertAscii: false,
    alertColor: true,
    logger: null,
    quietDeps: false,
    verbose: true,
  },
}

function dartSassWrapper(options = {}) {
  const { SourceMapConsumer, SourceMapGenerator } = require('source-map')
  const { render, renderSync, compileString, compileStringAsync, compile, compileAsync } = require('sass-embedded')

  options = { ...DEFAULT_OPTIONS, ...options }
  options.sass = { ...DEFAULT_OPTIONS.sass, ...options.sass }
  options.sass.includePaths = [...DEFAULT_OPTIONS.sass.includePaths, ...options.sass.includePaths]

  async function transform(file, encoding, callback) {
    if (basename(file.path).indexOf('_') === 0) {
      return callback() // Sass convention says files beginning with an underscore should be used via @import only, so remove the file from the stream
    }

    if (!file.contents.length) {
      file.path = join(dirname(file.path), basename(file.path, extname(file.path)) + '.css')
      return callback(null, file)
    }

    options.sass.includePaths.unshift(dirname(file.path))
    options.sass.loadPaths.unshift(dirname(file.path))

    let result = {}

    options.sass = { ...options.sass, data: file.contents.toString(), file: file.path, outFile: options.sass.sourceMap ? 'main.css' : false }

    try {
      result = await compileStringAsync(file.contents.toString(), options.sass)
    } catch (error) {
      return callback(error)
    }

    if (!result.css) {
      return callback(new Error('Stylesheet not generated.'))
    }

    if (result.map) {
      const sourceMap = JSON.parse(result.map.toString('utf8'))

      sourceMap.sources = sourceMap.sources.map((source, index) => (~source.indexOf('file://') ? relative(file.base, source.substr(7)) : source)) // Convert absolute to relative paths
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

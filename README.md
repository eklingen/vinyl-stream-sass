
# Small vinyl-stream wrapper -aka Gulp plugin- for sass (dart-sass).

Run Sass within your streams. This fully supports source maps.

> *NOTE:* No tests have been written yet!

## Installation

`yarn install`. Or `npm install`. Or just copy the files to your own project.

## Usage

```
const sassWrapper = require('@eklingen/vinyl-stream-sass')
stream.pipe(sassWrapper())
```

## Options

There are a few options.

## `tryBinary`

Try to compile via the `sass` binary. Default is `true`. It tries to use the included binary. With larger `.scss` files, this method is faster. However, with smaller files, the async overhead might make it slower. In that case, set `tryBinary: false`. If it can't find the binary for the current architecture, or if there is no result returned, it will try the `sass` javascript package as a fallback.

```
sassWrapper({
  tryBinary: true
})
```

### `sass`

These options are passed verbatim into `sass`. For more information, see the ["sass"](https://www.npmjs.com/package/sass) documentation.

```
sassWrapper({
  outputStyle: 'compressed', // or 'extended'
  charset: true,
  errorCss: true,
  sourceMap: true,
  sourceMapContents: true
})
```

## Dependencies

This package requires ["sass"](https://www.npmjs.com/package/sass) and ["vinyl-sourcemaps-apply"](https://www.npmjs.com/package/vinyl-sourcemaps-apply).

---

Copyright (c) 2019 Elco Klingen. MIT License.

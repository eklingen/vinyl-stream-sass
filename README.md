
# Small vinyl-stream wrapper -aka Gulp plugin- for sass (dart-sass)

Run Sass within your streams. This fully supports source maps.

> *NOTE:* No tests have been written yet!
> *NOTE:* Since v5.0.0, the binary option has been removed.

## Installation

`yarn install`. Or `npm install`. Or just copy the files to your own project.

## Usage

```javascript
const sassWrapper = require('@eklingen/vinyl-stream-sass')
stream.pipe(sassWrapper())
```

## Options

There are a few options.

### `sass`

These options are passed verbatim into `sass`. For more information, see the ["sass"](https://www.npmjs.com/package/sass) documentation.

```javascript
sassWrapper({
  outputStyle: 'compressed', // or 'extended'
  charset: true,
  errorCss: true,
  sourceMap: true,
  sourceMapContents: true
})
```

## Dependencies

This package requires ["sass"](https://www.npmjs.com/package/sass) and ["source-map"](https://www.npmjs.com/package/source-map).

---

Copyright (c) 2019 Elco Klingen. MIT License.

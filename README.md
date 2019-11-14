
# Small vinyl-stream wrapper -aka Gulp plugin- for sass (dart-sass).

Run Sass within your streams. This fully supports sourcemaps. With an experimental hyperfast method.
This hyperfast method is hacky and dirty, but you don't have to use it.

> *NOTE:* No tests have been written yet!

## Installation

`yarn install`. Or `npm install`. Or just copy the files to your own project.

## Usage

```
const sassWrapper = require('@eklingen/vinyl-stream-sass')
stream.pipe(sassWrapper())
```

## Options

There are no options. Well, except for...

## The hyperfast method

Try out the hyperfast method via passing `experimentalTryBinary: true`. This **needs extra configuration**, more on that below.

1. Check the latest dart-sass releases on: https://github.com/sass/dart-sass/releases.

2. Add the desired version for your OS as an optional dependency to your package.json. It **must** be called `binaries__dart-sass` (with the double underscore).

```
optionalDependencies": {
  "binaries__dart-sass": "https://github.com/sass/dart-sass/releases/download/1.23.3/dart-sass-1.23.3-macos-x64.tar.gz"
}
```

3. Run `yarn` or `npm` to install it.
4. Pass the `experimentalBinary: true` option.

```
sassWrapper({
  experimentalTryBinary: true
})
```

This package will try to use the binary if at all possible. When that fails, it will run the normal `sass` package.
And yes, it also fully supports sourcemaps in this mode.

## Dependencies

This package requires ["sass"](https://www.npmjs.com/package/sass) and ["vinyl-sourcemaps-apply"](https://www.npmjs.com/package/vinyl-sourcemaps-apply).

---

Copyright (c) 2019 Elco Klingen. MIT License.

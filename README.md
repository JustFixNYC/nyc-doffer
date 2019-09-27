## Installation

You will need `pdftotext` on your path. This is contained in the
[Xpdf command line tools](https://www.xpdfreader.com/download.html).

To install, build, and run the app:

```
yarn
yarn build
node doffer.js
```

Note that you will need to run `yarn build` whenever you change the code. Alternatively,
run `yarn watch` in a separate terminal.

## Running tests

Run tests via:

```
yarn test
```

You can also run tests in watch mode. To do this, use `yarn test:watch`.

## Running integration tests with the DOF website

To run tests against the DOF website to make sure scraping works, run:

```
node test-dof-site.js
```

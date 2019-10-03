This is a tool that scrapes the NYC Department of Finance (DOF) website
for financial statements and provides the following data:

* Net operating income
* Rent stabilized units

The tool's architecture makes it straightforward to extract additional
metrics from the statements if needed.

## Installation

You will need `pdftotext` version 4.02 on your path, or defined via the
`PDFTOTEXT` environment variable (if an `.env` file is found in the root directory
of the repository, it will be loaded). You can obtain it by downloading
and installing one of the following:

* [Xpdf command line tools (Linux)](https://xpdfreader-dl.s3.amazonaws.com/xpdf-tools-linux-4.02.tar.gz)
* [Xpdf command line tools (Windows)](https://xpdfreader-dl.s3.amazonaws.com/xpdf-tools-win-4.02.zip)
* [Xpdf command line tools (OS X)](https://xpdfreader-dl.s3.amazonaws.com/xpdf-tools-mac-4.02.tar.gz)

To install and build the app:

```
yarn
yarn build
```

Note that you will need to run `yarn build` whenever you change the code. Alternatively,
run `yarn watch` in a separate terminal.

You can run the tool by passing it an address to search for, e.g.:

```
node -r esm doffer.js "654 park place, brooklyn"
```

## Running the web server

You can run a web server that asks the user for an address, scrapes it,
and returns a table of scraped data with links back to source PDF files:

```
node -r esm webserver.js
```

Then visit http://localhost:3000.

### Deploying the web server

You can deploy the web server **for development and testing purposes only**,
as it isn't designed to scale beyond a single process.

To do so via Heroku, you can run:

```
heroku container:push web
heroku container:release web
```

## Running tests

Run tests via:

```
yarn test
```

You can also run tests in watch mode. To do this, use `yarn test:watch`.

## Running integration tests with the DOF website

To run tests against the DOF website to make sure scraping works, run:

```
node -r esm test-dof-site.js
```

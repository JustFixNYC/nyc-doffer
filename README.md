[![Actions Status](https://github.com/JustFixNYC/nyc-doffer/workflows/Node%20CI/badge.svg)](https://github.com/JustFixNYC/nyc-doffer/actions)

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

You may want to create an `.env` file to configure environment variables. This
can be done by copying the sample file and editing it as needed:

```
cp .env.sample .env
```

To install and build the app:

```
yarn
yarn build
```

Note that you will need to run `yarn build` whenever you change the code. Alternatively,
run `yarn watch` in a separate terminal.

You can run the tool by passing it an address to search for, e.g.:

```
node doffer.js "654 park place, brooklyn"
```

## Environment variables

See the [`.env.sample`](.env.sample) file for documentation on environment variables.

## Running the web server

You can run a web server that asks the user for an address, scrapes it,
and returns a table of scraped data with links back to source PDF files:

```
node webserver.js
```

Then visit http://localhost:3000.

### Deploying the web server

You can deploy the web server **for development and testing purposes only**,
as it isn't designed to scale beyond a single process.

To do so via Heroku, you can run:

```
heroku container:push web && heroku container:release web
```

You can also try using `node deploy-to-heroku.js`.

## Batch jobs

You can optionally integrate with a Postgres database to run
batch jobs that scrape DOF records for swaths of the city,
also integrating with [NYCDB][] to figure out what BBLs to cover.

### Database integration

You will need to create a Postgres database and user
by running `psql` as an administrative user, e.g.:

```
psql -U postgres
```

Then run:

```
create database doffer;
create user doffer with encrypted password 'doffer';
grant all privileges on database doffer to doffer;
```

You should now be able to access the database by setting the
following environment variable:

```
DATABASE_URL=postgres://doffer:doffer@localhost/doffer
```

Now you can test your connection with:

```
node dbtool.js test_connection
```

### NYCDB integration

Define the `NYCDB_URL` environment variable and test your connection with:

```
node dbtool.js test_nycdb_connection
```

[NYCDB]: https://github.com/nycdb/nycdb

### Running a batch job

All information about a batch job is stored in a single table, which
you name.  To build a table called `boop`, that uses BBLs from
the `bbl` column of NYCDB's HPD registrations dataset, use:

```
node dbtool.js build_bbl_table boop hpd_registrations
```

Now you can scrape the BBLs in the table with:

```
node dbtool.js scrape boop
```

The table keeps track of what BBLs were scraped successfully,
which still need to be scraped, and which had errors occur. You can
view these statistics with:

```
node dbtool.js scrape_status boop
```

You can also clear the "error" state on all BBLs, essentially
re-queuing them for scraping, with the following command:

```
node dbtool.js clear_scraping_errors boop
```

## Running tests

Run tests via:

```
yarn test
```

You can also run tests in watch mode. To do this, use `yarn test:watch`.

Note that tests run the project's compiled JS; they don't automatically convert
the TS to JS. This means that you will need to run `yarn build` before running
`yarn test`, and `yarn watch` concurrently with `yarn test:watch`.

## Running integration tests with the DOF website

To run tests against the DOF website to make sure scraping works, run:

```
node test-dof-site.js
```

## Running integration tests with your configured cache

To run tests against your configured cache to make sure it works, run:

```
node test-configured-cache.js
```

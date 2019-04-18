# news-ingress

Small utility application to work with Galnet

## Environment Configuration

The following environment variables are required:

* NEWS_INGRESS_DEVELOPMENT_COUCHDB_URL
* NEWS_INGRESS_DEVELOPMENT_NEO4J_URL

Optional, but may apply:

* NEWS_INGRESS_DEVELOPMENT_NEO4J_USERNAME
* NEWS_INGRESS_DEVELOPMENT_NEO4J_PASSWORD

## Installation

```
npm install
```

## Usage

```
npm start
```

You will be presented with a small menu that asks you which task you would like
to run.

### Using Docker Compose

```
docker-compose up
```

The included `docker-compose.yml` contains insecure data services that are used
by this application. This is useful for development and is not intended for
production use.

## License

This project is licensed under the [ISC License](LICENSE).

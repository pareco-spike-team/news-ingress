news-ingress
==============================================================================

Imports Galnet News CSV into Neo4j

Environment Configuration
------------------------------------------------------------------------------

The following environment variables are required:

* NEWS_INGRESS_DEVELOPMENT_NEO4J_URL

Optional, but may apply:

* NEWS_INGRESS_DEVELOPMENT_NEO4J_USERNAME
* NEWS_INGRESS_DEVELOPMENT_NEO4J_PASSWORD

Installation
------------------------------------------------------------------------------

```
npm install
```

Usage
------------------------------------------------------------------------------

You can call `npm start` to automatically begin importing the `feed.csv` into
neo4j.

License
------------------------------------------------------------------------------

This project is licensed under the [ISC License](LICENSE).
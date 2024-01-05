# 1.8.0

* Removed support for unframing `application/grpc-web+json` requests (#567).
* Added full support for handling grpc-web and grpc-web-text requests during request matching (#548).
* Bumped many versions of third-party dependencies.

# 1.7.0

* Add new CLI option `--exact-request-matching` to force `replay` mode to only return tapes with a 100% match; best-effort matching is disabled (#556).
* Refactored the internal representation of HTTP requests and responses (#554).
* Refactored the implementation of, and libraries used, to handle compression (#555).
* Bumped many versions of third-party dependencies.

# 1.6.1

* Extend unframing support to allow a wildcard hostname `*` (#503).

# 1.6.0

* Optional support for unframing `application/grpc-web+json` requests to whitelisted hostnames (#501).

# 1.5.0

* Allow optional rewrite rules before computing similarity scores during replay (#499).

# 1.4.0

* Optionally support accepting incoming requests on HTTPS in addition to HTTP (#472).
* Drop `if-*` headers on incoming requests in `record` mode by default (#473).
* Bumped versions of third-party dependencies

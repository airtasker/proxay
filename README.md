# Proxay

[![CircleCI](https://circleci.com/gh/airtasker/proxay.svg?style=svg)](https://circleci.com/gh/airtasker/proxay)

Proxay (pronounced "prokseï") is a proxy server that helps you write faster tests.

Use Proxay as a layer between a client and its backend to record interactions and later replay them on demand.

You can use Proxay to proxy interactions between:
- a web frontend and its backend
- a mobile app and its backend
- a server and another server (or a set of others, if using multiple Proxay instances)

Proxay can operate in several modes:
- **Record mode**: Proxies requests to the backend and records interactions as "tapes" on disk.
- **Replay mode**: Replays requests from your "tapes" on disk (no backend necessary).
- **Mimic mode**: Records requests the first time it encounters them, then replays them (record then replay).
- **Passthrough mode**: Proxies requests without persisting them (like a conventional proxy).

Proxay is language-agnostic: it's just a server. Your code doesn't need to be written in JavaScript to benefit from using it.

## Installing

Make sure you have [NPM](https://www.npmjs.com) installed, then run:
```sh
npm install --global proxay

# or if you're using Yarn
yarn global add proxay
```

## Running

```sh
# Record mode (proxies requests)
proxay --mode record --host https://api.website.com --tapes tapes/

# Replay mode (no proxying)
proxay --mode replay --tapes tapes/

# Passthrough mode (proxies requests without persisting)
proxay --mode passthrough --host https://api.website.com
```

You can also run several instances of Proxay simultaneously on different ports (for example to proxy
multiple backends). Just pick a different port (e.g. `--port 3001`).

## Specifying a tape

If you have several tests, you likely want to save recorded interactions into one tape per test,
and replay from the correct tape for each test.

You can do this by sending a `POST` request to `/__proxay/tape` with the following payload:
```json
{
  "tape": "test1/my tape"
}
```

In record mode, this will create a new file `test1/my tape.yml` within your tapes directory.
In replay mode, this same file will be read from your tapes directory.

You can leverage this by picking a tape based on the current test's name in the `beforeEach`
block of your test suite.

## Typical use case

Let's say you're writing tests for your client. You want your tests to run as
fast as possible, but your backend is quite slow. Or worse, you have some tests already,
but they're flaky because your backend or one of its dependencies isn't completely
reliable.

Instead of pointing your client to your backend like you normally would, use Proxay
as your backend. Tell Proxay to record requests going to the backend and run your tests
once. This will create "tapes" which are records of each request/response between your
client and your backend.

Then, run Proxay in replay mode and run your tests again. Your tests should still work,
but you'll notice tests run a lot faster. That's because your backend is not used anymore.
Instead, Proxay plays back responses from the tapes it had previously recorded.

This will make your tests faster and more stable. However, because you no longer use a real
backend, you should still make sure to run your jobs in "record" mode on a regular basis (for
example with a cron job on your CI) to test the implicit contract between your client and
backend.

---

## Comparison with alternatives

### [`node-replay`](https://github.com/assaf/node-replay)

`node-replay` is an inspiration for Proxay.

However, `node-replay` isn't a proxy per se: it simply replaces `require('http').request` in Node
with its own method. This means that you can only use `node-replay` when running tests within Node.

Proxay is more versatile. It's "just a server". You can use it for anything you want, including as
part of your test infrastructure for your web or mobile applications.

### [`yakbak`](https://github.com/flickr/yakbak)

Proxay is very similar to `yakbak`. There are a couple of differences:

- Proxay is purely an HTTP server. You control it through HTTP as well (see [**Specifying a tape**](#specifying-a-tape)).
- Proxay automatically replaces `host` headers so the backend doesn't reject mismatching requests.

### [`vcr`](https://github.com/vcr/vcr)

VCR is a Ruby gem with a similar approach to `node-replay`. Just like `node-replay`, it cannot be
used as a general-purpose proxy. It can only be used to test Ruby software.

### [`MockServer`](https://github.com/jamesdbloom/mockserver)

MockServer does a lot more things than Proxay.

If you need something more elaborate than Proxay, for example the ability to mock out specific URL
patterns, you may need MockServer.

However, if all you need is a simple record/replay proxy layer, you'll probably find that Proxay is
much easier to set up and run.

---

## Releasing a new version of Proxay (for contributors)

To release a new version of Proxay, follow the following two steps:

### Update the version in `master`

1. Create a new branch.
2. Update the `version` field in `package.json`.
3. Send a PR with the changes (commit message `Release [version]`).
4. Merge the PR into master.

### Create a release on GitHub

1. Visit the [releases page](https://github.com/airtasker/proxay/releases) to see what was last announced.
2. Draft a new release:
    - Tag = `v[version]` (e.g. `v2.1.1`). **Do not forget the `v`, which is required to trigger the NPM publish on CircleCI.**
    - Title = `Release v[version]` (e.g. `Release v2.1.1`)
3. Make sure to announce major changes since the last version in the description.
4. Once published, [check CircleCI](https://circleci.com/gh/airtasker/proxay) to ensure publication was successful.

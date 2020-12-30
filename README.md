# Secretariat

## Submit assets

- protocol: `http`
- path: `/assets?id=<project-id>`
- method: `POST`
- Content-Type: `application/json`
- body: JSON of assets

## Delete all assets

- protocol: `http`
- path: `/assets?id=<project-id>`
- method: `DELETE`

## Get the latest assets

- protocol: `http`
- path: `/assets/latest?id=<project-id>`
- method: `GET`

### Response

- Content-Type: `application/json`
- body: JSON of assets

All `Big` field is of `number`, so precision may be lost.

## Get all balances

- protocol: `http`
- path: `/balances?id=<project-id>`
- method: `GET`

### Response

- Content-Type: `application/json`
- body: JSON of `[<balance>, <time>][]` in ascending order by `time`

## Get realtime assets

- protocol: `ws`
- path: `/assets?id=<project-id>`

### Received messages

- body: JSON of each assets

All `Big` field is of `string`, so no precision is lost.

## Database

Make sure to operate on database only via secretary, because promisified-sqlite makes transactions as cache.

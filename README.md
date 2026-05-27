# Distributed Key Server

This is a small POC distributed key server.


The POC is intentionally static:

- `generate-configs` creates a threshold master secret and one scalar share per party.
- `serve` runs one HTTP key-share server from a YAML config.
- `request` asks multiple servers for encrypted partial keys, verifies the shares, aggregates a threshold set, decrypts the aggregated key, and verifies it against the recovered master public key.
- `encrypt` encrypts local user data offline using only public config.
- `decrypt` contacts threshold servers, recovers the IBE key for the embedded `key_id`, and decrypts the sealed data.

This is not production DKG. The generator creates all server shares locally for demo purposes.

## Model

Each server holds one share of the IBE master secret. For a `key_id`, a server derives:

```text
partial_key = H(key_id) * master_share
```

The server encrypts that partial key to the client's ephemeral ElGamal public key and returns it.
The client verifies the encrypted partial key against the server's partial public key, collects `threshold` valid responses, and homomorphically aggregates the encrypted shares. After decrypting the aggregate, the client has the IBE user secret key for `key_id`.

For user data encryption, the client generates a random data key, encrypts the file with AES-256-GCM, then encrypts that data key under the master public key for the chosen `key_id`. Encryption is offline. Decryption requires threshold server participation.

## Build

From this directory:

```bash
cargo check
```

The first build may need network access to fetch dependencies.

## Run A 2-of-3 Demo

Generate three server configs:

```bash
cargo run -- generate-configs \
  --threshold 2 \
  --parties 3 \
  --base-port 4101 \
  --out-dir configs
```

Start three servers in separate terminals:

```bash
cargo run -- serve --config configs/server-0.yaml --public-config configs/public.yaml
cargo run -- serve --config configs/server-1.yaml --public-config configs/public.yaml
cargo run -- serve --config configs/server-2.yaml --public-config configs/public.yaml
```

Request and aggregate a key:

```bash
cargo run -- request \
  --key-id demo-document-42 \
  --servers http://127.0.0.1:4101 \
  --servers http://127.0.0.1:4102 \
  --servers http://127.0.0.1:4103
```

Expected output includes:

```text
Aggregated 2 verified shares.
Key id: demo-document-42
Recovered master public key: ...
Decryption key: ...
```

## Encrypt And Decrypt User Data

Create a plaintext file:

```bash
echo "hello distributed key server" > message.txt
```

Encrypt it locally with the public config:

```bash
cargo run -- encrypt \
  --public-config configs/public.yaml \
  --key-id user:alice:file:message.txt \
  --input message.txt \
  --output message.sealed.json
```

Decrypt it by contacting the threshold servers:

```bash
cargo run -- decrypt \
  --input message.sealed.json \
  --output message.decrypted.txt \
  --servers http://127.0.0.1:4101 \
  --servers http://127.0.0.1:4102 \
  --servers http://127.0.0.1:4103
```

Check the result:

```bash
diff message.txt message.decrypted.txt
```

The important property is that `encrypt` only needs `configs/public.yaml`; it does not contact key servers. `decrypt` must fetch and aggregate threshold key shares.

## HTTP API

`GET /service`

Returns:

```json
{
  "party_id": 0,
  "threshold": 2,
  "partial_public_key": "..."
}
```

`POST /fetch_key`

Takes:

```json
{
  "key_id": "demo-document-42",
  "enc_key": "...",
  "enc_verification_key": "..."
}
```

Returns:

```json
{
  "party_id": 0,
  "key_id": "demo-document-42",
  "encrypted_key_share": "..."
}
```

The JSON shape for the crypto values is the serde representation from the local `crypto` and `fastcrypto` types.

## What Is Missing

This POC deliberately does not include:

- real distributed key generation
- server authentication
- client request signatures
- access policy enforcement
- committee rotation
- persistence beyond static YAML configs
- TLS or API keys

Those are the next layers to add after the core threshold flow is easy to inspect.

# Distributed Key Server

This is a small POC distributed key server.

The POC is intentionally static:

- `generate-configs` creates a threshold master secret and one scalar share per party.
- `serve` runs one HTTP key-share server from a YAML config.
- `request` asks multiple servers for encrypted partial keys, verifies the shares, aggregates a threshold set, decrypts the aggregated key, and verifies it against the recovered master public key.
- `encrypt` encrypts local user data offline using only public config.
- `decrypt` contacts threshold servers, recovers the IBE key for the embedded `key_id`, and decrypts the sealed data.

This is not production DKG. The generator creates all server shares locally for demo purposes.

## Secure Key Distribution for Production

In production, the `master_share_hex` values must be distributed securely to each server. The demo `generate-configs` command creates all shares on a single machine, which is acceptable for testing but violates the security model in production.

### Split Ceremony with Operator-Generated Contributions

Each server operator contributes randomness, so no single party ever sees the complete master secret:

1. **Each operator generates their contribution:**
   ```bash
   # Operator 0 runs:
   cargo run -- generate-contribution --party-id 0 --threshold 2 --parties 3
   # Outputs: contribution-0.json (contains encrypted commitment)

   # Operator 1 runs:
   cargo run -- generate-contribution --party-id 1 --threshold 2 --parties 3
   # Outputs: contribution-1.json

   # Operator 2 runs:
   cargo run -- generate-contribution --party-id 2 --threshold 2 --parties 3
   # Outputs: contribution-2.json
   ```

2. **Exchange contributions (public channel is OK):**
   ```bash
   # All operators share their contribution-X.json files
   # These contain Feldman VSS commitments, not raw secrets
   ```

3. **Each operator computes their final share:**
   ```bash
   # Operator 0 runs:
   cargo run -- combine-contributions \
     --my-party-id 0 \
     --contributions contribution-0.json,contribution-1.json,contribution-2.json
   # Outputs: server-0.yaml (only contains their share)
   ```

4. **Verify consistency:**
   ```bash
   # Any party can verify all shares are consistent without seeing them:
   cargo run -- verify-shares \
     --contributions contribution-0.json,contribution-1.json,contribution-2.json
   ```

> **Note:** The `generate-contribution`, `combine-contributions`, and `verify-shares` commands are not yet implemented.

### Share Verification After Distribution

After distributing shares, verify consistency without revealing them:

```bash
# Each server exposes its partial public key at /service
curl http://server-0:3021/service | jq .partial_public_key
curl http://server-1:3022/service | jq .partial_public_key
curl http://server-2:3023/service | jq .partial_public_key

# Verify that partial public keys are consistent with master public key
cargo run -- verify-deployment --public-config configs/public.yaml \
  --servers http://server-0:3021,http://server-1:3022,http://server-2:3023
```

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

### Step 1: Generate Server Configurations

Generate configs for a 2-of-3 threshold setup on ports 3021-3023:

```bash
cargo run --release -- generate-configs \
  --threshold 2 \
  --parties 3 \
  --base-port 3021 \
  --out-dir configs
```

This creates:

- `configs/server-0.yaml` (port 3021)
- `configs/server-1.yaml` (port 3022)
- `configs/server-2.yaml` (port 3023)
- `configs/public.yaml` (public configuration for clients)

### Step 2: Run Servers Manually (Development/Testing)

For testing, run each server in a separate terminal or use screen/tmux:

```bash
# Terminal 1
cargo run --release -- serve --config configs/server-0.yaml --public-config configs/public.yaml

# Terminal 2
cargo run --release -- serve --config configs/server-1.yaml --public-config configs/public.yaml

# Terminal 3
cargo run --release -- serve --config configs/server-2.yaml --public-config configs/public.yaml
```

Or use nohup for background execution:

```bash
nohup cargo run --release -- serve --config configs/server-0.yaml --public-config configs/public.yaml > server-0.log 2>&1 &
nohup cargo run --release -- serve --config configs/server-1.yaml --public-config configs/public.yaml > server-1.log 2>&1 &
nohup cargo run --release -- serve --config configs/server-2.yaml --public-config configs/public.yaml > server-2.log 2>&1 &
```

### Step 3: Verify Deployment

From your local machine, test the servers:

```bash
# Check service endpoint for each server
curl http://<EC2_PUBLIC_IP>:3021/service
curl http://<EC2_PUBLIC_IP>:3022/service
curl http://<EC2_PUBLIC_IP>:3023/service
```

Request and aggregate a key:

```bash
cargo run -- request \
  --key-id demo-document-42 \
  --servers http://<EC2_PUBLIC_IP>:3021 \
  --servers http://<EC2_PUBLIC_IP>:3022 \
  --servers http://<EC2_PUBLIC_IP>:3023
```

### Step 9: Client Configuration

Copy `configs/public.yaml` to client machines for encryption operations:

```bash
scp -i your-key.pem ec2-user@<EC2_PUBLIC_IP>:~/distributed-key-server/server/configs/public.yaml ./
```

Update client commands to use EC2 server URLs:

```bash
# Encrypt locally (only needs public.yaml)
cargo run -- encrypt \
  --public-config public.yaml \
  --key-id user:alice:file:document.txt \
  --input document.txt \
  --output document.sealed.json

# Decrypt via threshold servers
cargo run -- decrypt \
  --input document.sealed.json \
  --output document.decrypted.txt \
  --servers http://<EC2_PUBLIC_IP>:3021 \
  --servers http://<EC2_PUBLIC_IP>:3022 \
  --servers http://<EC2_PUBLIC_IP>:3023
```

### Monitoring and Logs

View server logs:

```bash
# For systemd services
sudo journalctl -u keyserver@0 -f
sudo journalctl -u keyserver@1 -f
sudo journalctl -u keyserver@2 -f

# For nohup background processes
tail -f server-0.log server-1.log server-2.log
```

lsof -i :PORT

# VM Static IP

3.213.0.115

Kill processes

```bash
fuser -k 3021/tcp 3022/tcp 3023/tcp
```

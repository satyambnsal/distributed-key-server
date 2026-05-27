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

## AWS EC2 Deployment

This section describes how to deploy the distributed key servers on AWS EC2 using ports 3021, 3022, and 3023.

### Prerequisites

- AWS account with EC2 access
- AWS CLI configured locally
- SSH key pair for EC2 access

### Step 1: Launch EC2 Instance

1. Log into AWS Console and navigate to EC2
2. Click **Launch Instance**
3. Configure the instance:
   - **Name**: `distributed-key-server`
   - **AMI**: Amazon Linux 2023 or Ubuntu 22.04 LTS
   - **Instance type**: t3.small or larger (recommended for cryptographic operations)
   - **Key pair**: Select or create an SSH key pair
   - **Network settings**: Create or select a security group (configure in Step 2)
   - **Storage**: 20 GB gp3 (minimum)

4. Click **Launch Instance**

### Step 2: Configure Security Group

Add inbound rules to allow traffic on the server ports:

| Type       | Protocol | Port Range | Source    | Description       |
|------------|----------|------------|-----------|-------------------|
| SSH        | TCP      | 22         | Your IP   | SSH access        |
| Custom TCP | TCP      | 3021       | 0.0.0.0/0 | Key server 0      |
| Custom TCP | TCP      | 3022       | 0.0.0.0/0 | Key server 1      |
| Custom TCP | TCP      | 3023       | 0.0.0.0/0 | Key server 2      |

For production, restrict source IPs to known clients instead of `0.0.0.0/0`.

### Step 3: Connect and Install Dependencies

SSH into your EC2 instance:

```bash
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

Install Rust and build tools:

```bash
# For Amazon Linux 2023
sudo yum update -y
sudo yum install -y gcc git openssl-devel

# For Ubuntu
# sudo apt update && sudo apt install -y build-essential git libssl-dev pkg-config

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Step 4: Clone and Build the Project

```bash
git clone <your-repository-url> distributed-key-server
cd distributed-key-server/server
cargo build --release
```

### Step 5: Generate Server Configurations

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

### Step 6: Run Servers with systemd (Production)

Create systemd service files for each server:

```bash
sudo tee /etc/systemd/system/keyserver@.service << 'EOF'
[Unit]
Description=Distributed Key Server %i
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/distributed-key-server/server
ExecStart=/home/ec2-user/distributed-key-server/server/target/release/server serve --config configs/server-%i.yaml --public-config configs/public.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start all three servers:

```bash
sudo systemctl daemon-reload
sudo systemctl enable keyserver@0 keyserver@1 keyserver@2
sudo systemctl start keyserver@0 keyserver@1 keyserver@2
```

Check status:

```bash
sudo systemctl status keyserver@0 keyserver@1 keyserver@2
```

### Step 7: Run Servers Manually (Development/Testing)

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

### Step 8: Verify Deployment

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

### Production Considerations

For production deployments, consider:

1. **Use separate EC2 instances** for each key server to ensure fault tolerance
2. **Enable HTTPS** using a reverse proxy (nginx/Caddy) with TLS certificates
3. **Use Elastic IPs** for stable public addresses
4. **Set up CloudWatch** for monitoring and alerting
5. **Configure automatic backups** of the config files (especially server private keys)
6. **Use AWS Secrets Manager** to store sensitive configuration
7. **Enable VPC** for network isolation between servers and clients

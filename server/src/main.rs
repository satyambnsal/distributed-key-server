use anyhow::{anyhow, Context, Result};
use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use clap::{Parser, Subcommand};
use crypto::{
    dem::Aes256Gcm,
    elgamal,
    ibe::{self, MasterKey, PublicKey, UserSecretKey},
    ObjectID, KEY_SIZE,
};
use fastcrypto::{
    error::FastCryptoError,
    groups::{
        bls12381::{G1Element, G2Element, Scalar, G1_ELEMENT_BYTE_LENGTH, G2_ELEMENT_BYTE_LENGTH},
        GroupElement, Scalar as _,
    },
    serde_helpers::ToFromByteArray,
};
use fastcrypto_tbls::{polynomial::Poly, types::IndexedValue};
use rand::{thread_rng, RngCore};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, net::SocketAddr, num::NonZeroU16, path::PathBuf, sync::Arc};
use tracing::{info, warn};

type ElGamalPublicKey = elgamal::PublicKey<UserSecretKey>;
type ElGamalVerificationKey = elgamal::VerificationKey<PublicKey>;
type EncryptedKeyShare = elgamal::Encryption<UserSecretKey>;

#[derive(Parser)]
#[command(author, version, about = "Sui-independent distributed key server POC")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Generate static server configs from a fresh threshold master secret.
    GenerateConfigs {
        #[arg(long)]
        threshold: u16,
        #[arg(long)]
        parties: u16,
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 4001)]
        base_port: u16,
        #[arg(long, default_value = "configs")]
        out_dir: PathBuf,
    },
    /// Run one key-share server from a generated YAML config.
    Serve {
        #[arg(long)]
        config: PathBuf,
    },
    /// Request a key from several servers and aggregate threshold shares.
    Request {
        #[arg(long)]
        key_id: String,
        #[arg(long, required = true)]
        servers: Vec<String>,
        #[arg(long)]
        threshold: Option<u16>,
    },
    /// Encrypt a file locally using only public config. No server call is needed.
    Encrypt {
        #[arg(long)]
        public_config: PathBuf,
        #[arg(long)]
        key_id: String,
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
    /// Decrypt a sealed file by fetching threshold key shares from servers.
    Decrypt {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        servers: Vec<String>,
        #[arg(long)]
        threshold: Option<u16>,
    },
}

#[derive(Clone, Serialize, Deserialize)]
struct ServerConfig {
    party_id: u16,
    threshold: u16,
    listen_addr: SocketAddr,
    master_share_hex: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct PublicConfig {
    threshold: u16,
    master_public_key_hex: String,
    servers: Vec<String>,
}

#[derive(Clone)]
struct AppState {
    config: ServerConfig,
    master_share: MasterKey,
    partial_public_key: PublicKey,
}

#[derive(Serialize, Deserialize)]
struct ServiceResponse {
    party_id: u16,
    threshold: u16,
    partial_public_key: PublicKey,
}

#[derive(Clone, Serialize, Deserialize)]
struct FetchKeyRequest {
    key_id: String,
    enc_key: ElGamalPublicKey,
    enc_verification_key: ElGamalVerificationKey,
}

#[derive(Clone, Serialize, Deserialize)]
struct FetchKeyResponse {
    party_id: u16,
    key_id: String,
    encrypted_key_share: EncryptedKeyShare,
}

#[derive(Serialize, Deserialize)]
struct SealedFile {
    version: u8,
    key_id: String,
    threshold: u16,
    master_public_key_hex: String,
    nonce_hex: String,
    encrypted_data_key_hex: String,
    ciphertext_hex: String,
}

struct AggregatedKey {
    user_secret_key: UserSecretKey,
    recovered_public_key: PublicKey,
    shares: usize,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "distributed_key_server_poc=info,tower_http=warn".into()),
        )
        .init();

    match Cli::parse().command {
        Command::GenerateConfigs {
            threshold,
            parties,
            host,
            base_port,
            out_dir,
        } => generate_configs(threshold, parties, &host, base_port, out_dir),
        Command::Serve { config } => serve(config).await,
        Command::Request {
            key_id,
            servers,
            threshold,
        } => request_key(key_id, servers, threshold).await,
        Command::Encrypt {
            public_config,
            key_id,
            input,
            output,
        } => encrypt_file(public_config, key_id, input, output),
        Command::Decrypt {
            input,
            output,
            servers,
            threshold,
        } => decrypt_file(input, output, servers, threshold).await,
    }
}

fn generate_configs(
    threshold: u16,
    parties: u16,
    host: &str,
    base_port: u16,
    out_dir: PathBuf,
) -> Result<()> {
    if threshold == 0 || parties == 0 || threshold > parties {
        return Err(anyhow!(
            "threshold and parties must satisfy 0 < threshold <= parties"
        ));
    }
    if parties == u16::MAX {
        return Err(anyhow!("party count must be less than {}", u16::MAX));
    }

    std::fs::create_dir_all(&out_dir)
        .with_context(|| format!("failed to create {}", out_dir.display()))?;

    let mut rng = thread_rng();
    let coefficients: Vec<Scalar> = (0..threshold).map(|_| Scalar::rand(&mut rng)).collect();
    let master_public_key = G2Element::generator() * coefficients[0];

    for party_id in 0..parties {
        let share = evaluate_scalar_polynomial(&coefficients, party_id)?;
        let listen_addr = format!("{}:{}", host, base_port + party_id).parse()?;
        let config = ServerConfig {
            party_id,
            threshold,
            listen_addr,
            master_share_hex: encode_scalar(&share),
        };
        let path = out_dir.join(format!("server-{}.yaml", party_id));
        std::fs::write(&path, serde_yaml::to_string(&config)?)
            .with_context(|| format!("failed to write {}", path.display()))?;
    }

    let master_public_key_path = out_dir.join("master-public-key.hex");
    std::fs::write(&master_public_key_path, encode_g2(&master_public_key))
        .with_context(|| format!("failed to write {}", master_public_key_path.display()))?;

    let public_config = PublicConfig {
        threshold,
        master_public_key_hex: encode_g2(&master_public_key),
        servers: (0..parties)
            .map(|party_id| format!("http://{}:{}", host, base_port + party_id))
            .collect(),
    };
    let public_config_path = out_dir.join("public.yaml");
    std::fs::write(&public_config_path, serde_yaml::to_string(&public_config)?)
        .with_context(|| format!("failed to write {}", public_config_path.display()))?;

    println!("Generated {parties} configs in {}", out_dir.display());
    println!("Threshold: {threshold}");
    println!("Master public key: {}", encode_g2(&master_public_key));
    println!("Public config: {}", public_config_path.display());
    Ok(())
}

async fn serve(config_path: PathBuf) -> Result<()> {
    let config: ServerConfig = serde_yaml::from_reader(
        std::fs::File::open(&config_path)
            .with_context(|| format!("failed to open {}", config_path.display()))?,
    )?;
    let master_share = decode_scalar(&config.master_share_hex)?;
    let partial_public_key = ibe::public_key_from_master_key(&master_share);
    let listen_addr = config.listen_addr;
    let party_id = config.party_id;

    let state = Arc::new(AppState {
        config,
        master_share,
        partial_public_key,
    });

    let app = Router::new()
        .route("/service", get(handle_service))
        .route("/fetch_key", post(handle_fetch_key))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(listen_addr).await?;
    info!("party {party_id} listening on http://{listen_addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn handle_service(State(state): State<Arc<AppState>>) -> Json<ServiceResponse> {
    Json(ServiceResponse {
        party_id: state.config.party_id,
        threshold: state.config.threshold,
        partial_public_key: state.partial_public_key,
    })
}

async fn handle_fetch_key(
    State(state): State<Arc<AppState>>,
    Json(request): Json<FetchKeyRequest>,
) -> Result<Json<FetchKeyResponse>, String> {
    if request.key_id.is_empty() {
        return Err("key_id must not be empty".to_string());
    }

    let key_id = request.key_id.as_bytes();
    let partial_key = ibe::extract(&state.master_share, key_id);
    let encrypted_key_share = elgamal::encrypt(&mut thread_rng(), &partial_key, &request.enc_key);

    Ok(Json(FetchKeyResponse {
        party_id: state.config.party_id,
        key_id: request.key_id,
        encrypted_key_share,
    }))
}

async fn request_key(key_id: String, servers: Vec<String>, threshold: Option<u16>) -> Result<()> {
    let aggregated = fetch_aggregated_key(&key_id, servers, threshold).await?;

    println!("Aggregated {} verified shares.", aggregated.shares);
    println!("Key id: {key_id}");
    println!(
        "Recovered master public key: {}",
        encode_g2(&aggregated.recovered_public_key)
    );
    println!("Decryption key: {}", encode_g1(&aggregated.user_secret_key));
    Ok(())
}

async fn fetch_aggregated_key(
    key_id: &str,
    servers: Vec<String>,
    threshold: Option<u16>,
) -> Result<AggregatedKey> {
    if key_id.is_empty() {
        return Err(anyhow!("key_id must not be empty"));
    }

    let client = reqwest::Client::new();
    let (enc_sk, enc_key, enc_verification_key) =
        elgamal::genkey::<UserSecretKey, PublicKey, _>(&mut thread_rng());

    let mut services = Vec::new();
    for server in &servers {
        let service: ServiceResponse = client
            .get(format!("{}/service", server.trim_end_matches('/')))
            .send()
            .await
            .with_context(|| format!("failed to call {server}/service"))?
            .error_for_status()?
            .json()
            .await?;
        services.push((server.clone(), service));
    }

    let threshold = threshold.unwrap_or_else(|| services[0].1.threshold);
    if threshold == 0 || services.len() < threshold as usize {
        return Err(anyhow!(
            "need at least threshold servers: got {}, threshold {}",
            services.len(),
            threshold
        ));
    }

    let mut seen_parties = HashSet::new();
    for (_, service) in &services {
        if service.threshold != threshold {
            warn!(
                "party {} reports threshold {}, using client threshold {}",
                service.party_id, service.threshold, threshold
            );
        }
        if !seen_parties.insert(service.party_id) {
            return Err(anyhow!("duplicate party id {}", service.party_id));
        }
    }

    let request = FetchKeyRequest {
        key_id: key_id.to_string(),
        enc_key,
        enc_verification_key,
    };

    let mut verified_shares = Vec::new();
    let mut verified_public_keys = Vec::new();
    for (server, service) in services {
        let response: FetchKeyResponse = client
            .post(format!("{}/fetch_key", server.trim_end_matches('/')))
            .json(&request)
            .send()
            .await
            .with_context(|| format!("failed to call {server}/fetch_key"))?
            .error_for_status()?
            .json()
            .await?;

        if response.party_id != service.party_id {
            return Err(anyhow!(
                "party id mismatch from {server}: service={}, response={}",
                service.party_id,
                response.party_id
            ));
        }
        if response.key_id != key_id {
            return Err(anyhow!("key_id mismatch from party {}", response.party_id));
        }

        ibe::verify_encrypted_signature(
            &response.encrypted_key_share,
            &request.enc_verification_key,
            &service.partial_public_key,
            key_id.as_bytes(),
        )
        .map_err(|e| {
            anyhow!(
                "invalid encrypted share from party {}: {e}",
                response.party_id
            )
        })?;

        verified_public_keys.push((response.party_id, service.partial_public_key));
        verified_shares.push((response.party_id, response.encrypted_key_share));
        if verified_shares.len() == threshold as usize {
            break;
        }
    }

    if verified_shares.len() < threshold as usize {
        return Err(anyhow!(
            "not enough verified shares: got {}, threshold {}",
            verified_shares.len(),
            threshold
        ));
    }

    let aggregated_encrypted_key = elgamal::aggregate_encrypted(threshold, &verified_shares)?;
    let decrypted_key = elgamal::decrypt(&enc_sk, &aggregated_encrypted_key);
    let recovered_public_key = recover_public_key(threshold, &verified_public_keys)?;

    ibe::verify_user_secret_key(&decrypted_key, key_id.as_bytes(), &recovered_public_key)
        .map_err(|e| anyhow!("aggregated key did not verify against recovered public key: {e}"))?;

    Ok(AggregatedKey {
        user_secret_key: decrypted_key,
        recovered_public_key,
        shares: verified_shares.len(),
    })
}

fn encrypt_file(
    public_config_path: PathBuf,
    key_id: String,
    input: PathBuf,
    output: PathBuf,
) -> Result<()> {
    if key_id.is_empty() {
        return Err(anyhow!("key_id must not be empty"));
    }

    let public_config: PublicConfig = serde_yaml::from_reader(
        std::fs::File::open(&public_config_path)
            .with_context(|| format!("failed to open {}", public_config_path.display()))?,
    )?;
    let master_public_key = decode_g2(&public_config.master_public_key_hex)?;
    let plaintext =
        std::fs::read(&input).with_context(|| format!("failed to read {}", input.display()))?;

    let mut data_key = [0u8; KEY_SIZE];
    thread_rng().fill_bytes(&mut data_key);

    let randomness = Scalar::rand(&mut thread_rng());
    let (nonce, encrypted_keys) = ibe::encrypt_batched_deterministic(
        &randomness,
        &[data_key],
        &[master_public_key],
        key_id.as_bytes(),
        &[poc_ibe_info()],
    )?;
    let encrypted_data_key = encrypted_keys
        .into_iter()
        .next()
        .ok_or_else(|| anyhow!("IBE encryption produced no encrypted data key"))?;
    let ciphertext = Aes256Gcm::encrypt(&plaintext, key_id.as_bytes(), &data_key);

    let sealed = SealedFile {
        version: 1,
        key_id: key_id.clone(),
        threshold: public_config.threshold,
        master_public_key_hex: public_config.master_public_key_hex,
        nonce_hex: encode_g2(&nonce),
        encrypted_data_key_hex: hex::encode(encrypted_data_key),
        ciphertext_hex: hex::encode(ciphertext),
    };

    std::fs::write(&output, serde_json::to_vec_pretty(&sealed)?)
        .with_context(|| format!("failed to write {}", output.display()))?;

    println!("Encrypted {} bytes.", plaintext.len());
    println!("Key id: {key_id}");
    println!("Output: {}", output.display());
    Ok(())
}

async fn decrypt_file(
    input: PathBuf,
    output: PathBuf,
    servers: Vec<String>,
    threshold: Option<u16>,
) -> Result<()> {
    let sealed: SealedFile = serde_json::from_slice(
        &std::fs::read(&input).with_context(|| format!("failed to read {}", input.display()))?,
    )?;
    if sealed.version != 1 {
        return Err(anyhow!(
            "unsupported sealed file version {}",
            sealed.version
        ));
    }

    let threshold = threshold.or(Some(sealed.threshold));
    let aggregated = fetch_aggregated_key(&sealed.key_id, servers, threshold).await?;
    let expected_public_key = decode_g2(&sealed.master_public_key_hex)?;
    if aggregated.recovered_public_key != expected_public_key {
        return Err(anyhow!(
            "server shares recovered a different master public key than the sealed file expects"
        ));
    }

    let nonce = decode_g2(&sealed.nonce_hex)?;
    let encrypted_data_key = decode_hex_array::<KEY_SIZE>(&sealed.encrypted_data_key_hex)?;
    let data_key = ibe::decrypt(
        &nonce,
        &encrypted_data_key,
        &aggregated.user_secret_key,
        sealed.key_id.as_bytes(),
        &poc_ibe_info(),
    );
    let ciphertext = hex::decode(&sealed.ciphertext_hex)?;
    let plaintext = Aes256Gcm::decrypt(&ciphertext, sealed.key_id.as_bytes(), &data_key)
        .map_err(|e| anyhow!("failed to decrypt payload: {e}"))?;

    std::fs::write(&output, &plaintext)
        .with_context(|| format!("failed to write {}", output.display()))?;

    println!("Aggregated {} verified shares.", aggregated.shares);
    println!("Decrypted {} bytes.", plaintext.len());
    println!("Output: {}", output.display());
    Ok(())
}

fn evaluate_scalar_polynomial(coefficients: &[Scalar], party_id: u16) -> Result<Scalar> {
    if party_id == u16::MAX {
        return Err(anyhow!("party id must be less than {}", u16::MAX));
    }

    let x = Scalar::from((party_id + 1) as u128);
    Ok(coefficients
        .iter()
        .rev()
        .fold(Scalar::zero(), |acc, coefficient| acc * x + coefficient))
}

fn recover_public_key(threshold: u16, public_keys: &[(u16, PublicKey)]) -> Result<PublicKey> {
    let indexed = public_keys
        .iter()
        .map(|(party_id, public_key)| {
            let index = NonZeroU16::new(party_id + 1).ok_or(FastCryptoError::InvalidInput)?;
            Ok(IndexedValue {
                index,
                value: *public_key,
            })
        })
        .collect::<Result<Vec<_>, FastCryptoError>>()?;

    Poly::<G2Element>::recover_c0(threshold, indexed.into_iter()).map_err(Into::into)
}

fn encode_scalar(value: &Scalar) -> String {
    hex::encode(value.to_byte_array())
}

fn encode_g1(value: &G1Element) -> String {
    hex::encode(value.to_byte_array())
}

fn encode_g2(value: &G2Element) -> String {
    hex::encode(value.to_byte_array())
}

fn decode_g2(value: &str) -> Result<G2Element> {
    let bytes = decode_hex_array::<G2_ELEMENT_BYTE_LENGTH>(value)?;
    G2Element::from_byte_array(&bytes).map_err(|e| anyhow!("invalid G2 element: {e}"))
}

#[allow(dead_code)]
fn decode_g1(value: &str) -> Result<G1Element> {
    let bytes = decode_hex_array::<G1_ELEMENT_BYTE_LENGTH>(value)?;
    G1Element::from_byte_array(&bytes).map_err(|e| anyhow!("invalid G1 element: {e}"))
}

fn decode_scalar(value: &str) -> Result<Scalar> {
    let bytes = decode_hex_array::<32>(value)?;
    Scalar::from_byte_array(&bytes).map_err(|e| anyhow!("invalid scalar: {e}"))
}

fn decode_hex_array<const N: usize>(value: &str) -> Result<[u8; N]> {
    let value = value.strip_prefix("0x").unwrap_or(value);
    let bytes = hex::decode(value)?;
    bytes
        .try_into()
        .map_err(|bytes: Vec<u8>| anyhow!("expected {N} bytes, got {}", bytes.len()))
}

fn poc_ibe_info() -> (ObjectID, u8) {
    (ObjectID::from([0u8; 32]), 0)
}

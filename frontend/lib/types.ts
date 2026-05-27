// Sealed file format (matches Rust backend)
export interface SealedData {
  version: number
  key_id: string
  threshold: number
  master_public_key_hex: string
  nonce_hex: string
  encrypted_data_key_hex: string
  ciphertext_hex: string
}

// Key server response types
export interface ServiceInfo {
  party_id: number
  threshold: number
  partial_public_key: string
}

export interface FetchKeyRequest {
  key_id: string
  enc_key: string
  enc_verification_key: string
}

export interface FetchKeyResponse {
  party_id: number
  key_id: string
  encrypted_key_share: string
}

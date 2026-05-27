/**
 * Client-side Identity-Based Encryption using BLS12-381
 * Based on Boneh-Franklin IBE scheme
 */

import { bls12_381 as bls } from '@noble/curves/bls12-381.js'
import { sha3_256 } from '@noble/hashes/sha3.js'

// Types for BLS12-381 points
type G1Point = ReturnType<typeof bls.G1.Point.fromHex>
type G2Point = ReturnType<typeof bls.G2.Point.fromHex>
type Fp12Element = ReturnType<typeof bls.pairing>

// Domain separation tags (must match Rust implementation)
const DST_ID = new TextEncoder().encode('SUI-SEAL-IBE-BLS12381-00')
const DST_KDF = new TextEncoder().encode('SUI-SEAL-IBE-BLS12381-H2-00')

const KEY_SIZE = 32

// POC info: (ObjectID::zero, index 0)
const POC_OBJECT_ID = new Uint8Array(32) // 32 zero bytes
const POC_INDEX = 0

export interface SealedData {
  version: number
  key_id: string
  threshold: number
  master_public_key_hex: string
  nonce_hex: string
  encrypted_data_key_hex: string
  ciphertext_hex: string
}

/**
 * Convert bytes to BigInt scalar for point multiplication
 */
function bytesToScalar(bytes: Uint8Array): bigint {
  return BigInt('0x' + bytesToHex(bytes))
}

/**
 * Hash identity to G1 point using the domain separation tag
 */
function hashToG1(id: Uint8Array): G1Point {
  const message = new Uint8Array([...DST_ID, ...id])
  return bls.G1.hashToCurve(message)
}

/**
 * Key derivation function matching the Rust implementation
 */
function kdf(
  pairingResult: Fp12Element,
  nonce: G2Point,
  gid: G1Point,
  objectId: Uint8Array,
  index: number
): Uint8Array {
  const hash = sha3_256.create()
  hash.update(DST_KDF)

  // Pairing result (Fp12 element) - serialize to bytes (576 bytes)
  const pairingBytes = bls.fields.Fp12.toBytes(pairingResult)
  hash.update(pairingBytes)

  // Nonce (G2 element) - 96 bytes compressed
  hash.update(nonce.toBytes(true))

  // gid (G1 element) - 48 bytes compressed
  hash.update(gid.toBytes(true))

  // Object ID - 32 bytes
  hash.update(objectId)

  // Index - 1 byte
  hash.update(new Uint8Array([index]))

  return hash.digest()
}

/**
 * XOR two byte arrays
 */
function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error('XOR: arrays must have the same length')
  }
  const result = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i]
  }
  return result
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(cleanHex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Fixed IV matching Rust implementation (must match crypto/src/dem.rs)
const AES_GCM_IV = new Uint8Array([
  138, 55, 153, 253, 198, 46, 121, 219, 160, 128, 89, 7, 214, 156, 148, 220
])

/**
 * AES-256-GCM encryption (using Web Crypto API)
 */
async function aesGcmEncrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  aad: Uint8Array
): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(key),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: AES_GCM_IV,
      additionalData: new Uint8Array(aad),
    },
    cryptoKey,
    new Uint8Array(plaintext)
  )

  return new Uint8Array(ciphertext)
}

/**
 * Encrypt data for a specific identity using IBE
 *
 * @param plaintext - The data to encrypt
 * @param keyId - The identity to encrypt for (e.g., "user:email@example.com")
 * @param masterPublicKeyHex - The master public key in hex format
 * @param threshold - The threshold for decryption
 * @returns Sealed data object ready for transmission
 */
export async function encrypt(
  plaintext: string,
  keyId: string,
  masterPublicKeyHex: string,
  threshold: number
): Promise<SealedData> {
  // Parse master public key (G2 element)
  const masterPublicKey = bls.G2.Point.fromHex(masterPublicKeyHex)

  // Generate random data key (32 bytes)
  const dataKey = bls.utils.randomSecretKey()

  // Generate random scalar for IBE
  const randomScalarBytes = bls.utils.randomSecretKey()
  const randomScalar = bytesToScalar(randomScalarBytes)

  // Convert key_id to bytes
  const keyIdBytes = new TextEncoder().encode(keyId)

  // Hash identity to G1: gid = H(key_id)
  const gid = hashToG1(keyIdBytes)

  // Compute gid_r = gid * r
  const gidR = gid.multiply(randomScalar)

  // Compute nonce = G2_generator * r
  const nonce = bls.G2.Point.BASE.multiply(randomScalar)

  // Compute pairing: e(gid_r, master_public_key)
  const pairingResult = bls.pairing(gidR, masterPublicKey)

  // Derive symmetric key using KDF
  const derivedKey = kdf(pairingResult, nonce, gid, POC_OBJECT_ID, POC_INDEX)

  // XOR data key with derived key to get encrypted data key
  const encryptedDataKey = xor(dataKey, derivedKey)

  // Encrypt plaintext with AES-256-GCM using data key
  const plaintextBytes = new TextEncoder().encode(plaintext)
  const ciphertext = await aesGcmEncrypt(plaintextBytes, dataKey, keyIdBytes)

  return {
    version: 1,
    key_id: keyId,
    threshold,
    master_public_key_hex: masterPublicKeyHex,
    nonce_hex: bytesToHex(nonce.toBytes(true)),
    encrypted_data_key_hex: bytesToHex(encryptedDataKey),
    ciphertext_hex: bytesToHex(ciphertext),
  }
}

/**
 * Validate that the master public key is a valid G2 element
 */
export function validateMasterPublicKey(hex: string): boolean {
  try {
    bls.G2.Point.fromHex(hex)
    return true
  } catch {
    return false
  }
}

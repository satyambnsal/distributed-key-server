import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import os from 'os'

const execAsync = promisify(exec)

// Path to the Rust server binary (adjust as needed)
const SERVER_BIN = path.resolve(process.cwd(), '../server/target/release/server')
const PUBLIC_CONFIG = path.resolve(process.cwd(), '../server/configs/public.yaml')

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const inputFile = path.join(tempDir, `ibe-input-${randomUUID()}.txt`)
  const outputFile = path.join(tempDir, `ibe-output-${randomUUID()}.sealed.json`)

  try {
    const { key_id, plaintext } = await request.json()

    if (!key_id || !plaintext) {
      return NextResponse.json(
        { error: 'key_id and plaintext are required' },
        { status: 400 }
      )
    }

    // Write plaintext to temp file
    await writeFile(inputFile, plaintext, 'utf-8')

    // Call Rust CLI to encrypt
    const cmd = `"${SERVER_BIN}" encrypt --public-config "${PUBLIC_CONFIG}" --key-id "${key_id}" --input "${inputFile}" --output "${outputFile}"`

    await execAsync(cmd)

    // Read the sealed output
    const sealedData = await readFile(outputFile, 'utf-8')
    const sealed = JSON.parse(sealedData)

    return NextResponse.json({ sealed })
  } catch (error) {
    console.error('Encryption error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Encryption failed' },
      { status: 500 }
    )
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputFile)
      await unlink(outputFile)
    } catch {
      // Ignore cleanup errors
    }
  }
}

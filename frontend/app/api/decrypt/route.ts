import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import path from 'path'
import os from 'os'
import { createClient } from '@/lib/supabase-server'
import { ibeConfig } from '@/constants'

const execAsync = promisify(exec)

// Path to the Rust server binary
const SERVER_BIN = path.resolve(process.cwd(), '../server/target/release/server')

export async function POST(request: Request) {
  const tempDir = os.tmpdir()
  const inputFile = path.join(tempDir, `ibe-sealed-${randomUUID()}.json`)
  const outputFile = path.join(tempDir, `ibe-decrypted-${randomUUID()}.txt`)

  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { sealed } = await request.json()

    if (!sealed) {
      return NextResponse.json(
        { error: 'sealed data is required' },
        { status: 400 }
      )
    }

    // Verify the key_id matches the authenticated user
    const expectedKeyId = `user:${user.email}`
    if (sealed.key_id !== expectedKeyId) {
      return NextResponse.json(
        { error: `Access denied. This data was encrypted for ${sealed.key_id}, but you are ${expectedKeyId}` },
        { status: 403 }
      )
    }

    // Write sealed data to temp file
    await writeFile(inputFile, JSON.stringify(sealed), 'utf-8')

    // Build server list arguments
    const serverArgs = ibeConfig.servers.map(s => `--servers "${s}"`).join(' ')

    // Call Rust CLI to decrypt
    const cmd = `"${SERVER_BIN}" decrypt --input "${inputFile}" --output "${outputFile}" ${serverArgs}`

    await execAsync(cmd, { timeout: 30000 }) // 30 second timeout

    // Read the decrypted output
    const plaintext = await readFile(outputFile, 'utf-8')

    return NextResponse.json({ plaintext })
  } catch (error) {
    console.error('Decryption error:', error)

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Decryption failed'

    if (errorMessage.includes('Connection refused')) {
      return NextResponse.json(
        { error: 'Key servers are not available. Please ensure the servers are running.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
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

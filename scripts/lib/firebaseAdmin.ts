import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const scriptsDir = dirname(fileURLToPath(import.meta.url))

function loadServiceAccount() {
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? join(scriptsDir, '..', 'serviceAccountKey.json')
  const raw = readFileSync(keyPath, 'utf-8')
  return JSON.parse(raw)
}

if (getApps().length === 0) {
  initializeApp({ credential: cert(loadServiceAccount()) })
}

export const db = getFirestore()

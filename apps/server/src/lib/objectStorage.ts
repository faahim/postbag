import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import type { Env } from "../env.js"

export type StoredFile = {
  readonly key: string
  readonly body: Uint8Array
  readonly contentType: string
  readonly filename: string
  readonly sha256: string
}

export type ObjectStorage = {
  put(file: StoredFile): Promise<void>
  delete(key: string): Promise<void>
  signedDownloadUrl(key: string, filename: string, expiresInSeconds?: number): Promise<string>
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
  return `attachment; filename="${ascii || "attachment"}"; filename*=UTF-8''${encoded}`
}

export function createObjectStorage(env: Env): ObjectStorage | null {
  if (
    env.STORAGE_ENDPOINT === undefined ||
    env.STORAGE_BUCKET === undefined ||
    env.STORAGE_ACCESS_KEY_ID === undefined ||
    env.STORAGE_SECRET_ACCESS_KEY === undefined
  ) {
    return null
  }

  const bucket = env.STORAGE_BUCKET
  const client = new S3Client({
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    },
  })

  return {
    async put(file) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: file.key,
          Body: file.body,
          ContentType: file.contentType,
          ContentDisposition: contentDisposition(file.filename),
          Metadata: { sha256: file.sha256 },
        }),
      )
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
    async signedDownloadUrl(key, filename, expiresInSeconds = 900) {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
          ResponseContentDisposition: contentDisposition(filename),
        }),
        { expiresIn: expiresInSeconds },
      )
    },
  }
}

import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }
    return null;
  }

  async downloadObject(file: File, res: Response, options: { cacheTtlSec?: number; inline?: boolean; filename?: string; originalFileName?: string } = {}) {
    const { cacheTtlSec = 3600, inline = false, filename, originalFileName } = options;
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file);
      const isPublic = aclPolicy?.visibility === "public";
      
      // Use provided filename, or fall back to object name
      let downloadName = filename || file.name.split('/').pop() || 'download';
      
      // Get the content type from object storage metadata
      const contentType = metadata.contentType || "application/octet-stream";
      
      // Add file extension based on content type if filename doesn't have one
      downloadName = ensureFileExtension(downloadName, contentType, originalFileName);
      
      const headers: Record<string, string | number | undefined> = {
        "Content-Type": contentType,
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      };
      
      // Set Content-Disposition based on inline flag
      if (inline) {
        headers["Content-Disposition"] = "inline";
      } else {
        // Use RFC 5987 encoding for better handling of special characters
        const asciiName = downloadName.replace(/[^\x20-\x7E]/g, '_');
        const utf8Name = encodeURIComponent(downloadName).replace(/'/g, "%27");
        headers["Content-Disposition"] = `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`;
      }
      
      res.set(headers);
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(customPath?: string): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = customPath 
      ? `${privateObjectDir}/${customPath}/${objectId}`
      : `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

const mimeToExtension: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'text/html': '.html',
  'application/json': '.json',
  'application/xml': '.xml',
  'application/zip': '.zip',
  'application/x-rar-compressed': '.rar',
  'application/x-7z-compressed': '.7z',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
};

const knownExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.tif', '.heic', '.heif', '.ico',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.txt', '.csv', '.html', '.htm', '.json', '.xml', '.md', '.rtf',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma',
]);

function hasKnownExtension(filename: string): boolean {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === filename.length - 1) {
    return false;
  }
  const ext = filename.slice(lastDotIndex).toLowerCase();
  return knownExtensions.has(ext);
}

function ensureFileExtension(filename: string, contentType: string, originalFileName?: string): string {
  const trimmedName = filename.trim();
  
  if (hasKnownExtension(trimmedName)) {
    return trimmedName;
  }
  
  const extension = mimeToExtension[contentType.toLowerCase()];
  if (extension) {
    return trimmedName + extension;
  }
  
  if (originalFileName && hasKnownExtension(originalFileName)) {
    const lastDotIndex = originalFileName.lastIndexOf('.');
    const originalExt = originalFileName.slice(lastDotIndex).toLowerCase();
    return trimmedName + originalExt;
  }
  
  return trimmedName;
}

// Extract plain text from a stored file buffer based on its content type / filename.
// Returns null when the file type is unsupported or extraction fails.
async function extractTextFromBuffer(
  buffer: Buffer,
  contentType: string,
  fileName: string,
): Promise<string | null> {
  const lowerName = fileName.toLowerCase();
  const lowerType = (contentType || "").toLowerCase();

  const isPdf = lowerType.includes("pdf") || lowerName.endsWith(".pdf");
  const isDocx =
    lowerType.includes("wordprocessingml") || lowerName.endsWith(".docx");
  const isPlainText =
    lowerType.startsWith("text/") ||
    lowerType.includes("json") ||
    lowerType.includes("xml") ||
    lowerType.includes("csv") ||
    /\.(txt|md|csv|json|xml|html?|log|rtf)$/.test(lowerName);

  try {
    if (isPdf) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const data = await parser.getText();
      return data.text || null;
    }
    if (isDocx) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || null;
    }
    if (isPlainText) {
      return buffer.toString("utf-8");
    }
  } catch (err) {
    console.error(`Failed to extract text from "${fileName}":`, err);
    return null;
  }
  return null;
}

// In-memory cache for extracted document text. Keyed by storage path, which is
// unique per uploaded object — replacing a document produces a new path, so the
// old entry is simply never read again. A short TTL bounds memory use and lets
// transient extraction failures recover on a later question.
const DOC_TEXT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const DOC_TEXT_CACHE_MAX_ENTRIES = 200;
const documentTextCache = new Map<
  string,
  { text: string | null; expiresAt: number }
>();

function pruneDocumentTextCache() {
  const now = Date.now();
  Array.from(documentTextCache.entries()).forEach(([key, entry]) => {
    if (entry.expiresAt <= now) {
      documentTextCache.delete(key);
    }
  });
  // If still too large, evict oldest insertion-order entries.
  while (documentTextCache.size > DOC_TEXT_CACHE_MAX_ENTRIES) {
    const oldestKey = documentTextCache.keys().next().value;
    if (oldestKey === undefined) break;
    documentTextCache.delete(oldestKey);
  }
}

// Drop a cached extraction (e.g. when a document is replaced or deleted).
export function invalidateDocumentTextCache(storagePath: string) {
  documentTextCache.delete(storagePath);
}

// Given an object storage path (e.g. "/objects/uploads/<id>"), download the file
// and return its extracted plain text, or null if it cannot be read. Results are
// cached in memory (keyed by storage path) so repeat questions about the same
// project don't re-download and re-parse the same files.
export async function extractDocumentText(
  storagePath: string,
  fileName: string,
): Promise<string | null> {
  const cached = documentTextCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.text;
  }

  let text: string | null;
  try {
    const file = await objectStorageService.getObjectEntityFile(storagePath);
    const [metadata] = await file.getMetadata();
    const contentType = metadata.contentType || "application/octet-stream";
    const [buffer] = await file.download();
    text = await extractTextFromBuffer(buffer, contentType, fileName);
  } catch (err) {
    console.error(`Failed to read document "${fileName}" (${storagePath}):`, err);
    return null;
  }

  documentTextCache.set(storagePath, {
    text,
    expiresAt: Date.now() + DOC_TEXT_CACHE_TTL_MS,
  });
  pruneDocumentTextCache();
  return text;
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

export const objectStorageService = new ObjectStorageService();

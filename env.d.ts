declare namespace Cloudflare {
  interface Env {
    FILES: R2Bucket;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    SESSION_SECRET?: string;
  }
}

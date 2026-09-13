// لایه‌ی ذخیره‌سازی فایل. پیاده‌سازی فعلی روی دیسک سرور است (خارج از public تا
// فایل‌ها هرگز مستقیماً از طریق URL عمومی قابل‌دسترس نباشند)؛ دانلود فقط از طریق
// endpoint محافظت‌شده‌ای انجام می‌شود که مالکیت کاربر را چک می‌کند.
// بعداً می‌توان پیاده‌سازی دیگری (مثلاً فضای ابری) را جایگزین DiskStorage کرد
// بدون اینکه منطق بالادست (webhook تلگرام، endpoint دانلود) تغییر کند.

import fs from "fs/promises";
import path from "path";

export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

const STORAGE_ROOT = path.join(process.cwd(), "storage");

function resolveSafePath(key: string): string {
  if (path.isAbsolute(key) || key.split(/[\\/]/).includes("..")) {
    throw new Error("کلید فایل نامعتبر است.");
  }
  return path.join(STORAGE_ROOT, key);
}

export class DiskStorage implements FileStorage {
  async save(key: string, data: Buffer): Promise<void> {
    const filePath = resolveSafePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(resolveSafePath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolveSafePath(key), { force: true });
  }
}

export const fileStorage: FileStorage = new DiskStorage();

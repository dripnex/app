import { promises as fs } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface LocalUser {
  id: string;
  email: string;
}

export class LocalIdentity {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = join(dataDir, 'local-user.json');
  }

  async save(email: string): Promise<LocalUser> {
    const user: LocalUser = {
      id: createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 32),
      email: email.toLowerCase(),
    };
    await fs.writeFile(this.filePath, JSON.stringify(user), 'utf8');
    return user;
  }

  async read(): Promise<LocalUser | null> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<LocalUser>;
      if (typeof parsed.id === 'string' && typeof parsed.email === 'string') {
        return { id: parsed.id, email: parsed.email };
      }
      return null;
    } catch {
      return null;
    }
  }

  async clear(): Promise<void> {
    await fs.unlink(this.filePath).catch(() => undefined);
  }
}

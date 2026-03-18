import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

function buildError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function parseRef(ref) {
  const value = String(ref || '').trim();
  if (!value) {
    return null;
  }

  if (!value.startsWith('keychain://inspiradb/')) {
    return {
      type: 'legacy-inline',
      legacySecret: value,
      ref: value,
    };
  }

  const account = value.replace('keychain://inspiradb/', '').trim();
  if (!account) {
    throw buildError('INVALID_KEY_REF', 'Missing keychain account in reference.');
  }

  return { account, ref: value };
}

export function isManagedKeychainRef(ref) {
  return String(ref || '').trim().startsWith('keychain://inspiradb/');
}

export class KeychainStore {
  constructor({ serviceName = 'com.inspiradb.desktop.api', storePath = '', encryption = null, requireEncryption = false } = {}) {
    this.serviceName = serviceName;
    this.storePath = String(storePath || '').trim();
    this.encryption = encryption;
    this.requireEncryption = requireEncryption;
    this.memoryStore = new Map();
  }

  canEncrypt() {
    return Boolean(this.encryption?.isEncryptionAvailable?.());
  }

  ensureEncryptionAvailable() {
    if (this.requireEncryption && !this.canEncrypt()) {
      throw buildError(
        'SECURE_STORAGE_UNAVAILABLE',
        'Secure storage is unavailable in the current environment.',
      );
    }
  }

  readDiskStore() {
    if (!this.storePath || !fs.existsSync(this.storePath)) {
      return { version: 1, services: {} };
    }

    try {
      const raw = fs.readFileSync(this.storePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return { version: 1, services: {} };
      }

      return {
        version: 1,
        services: typeof parsed.services === 'object' && parsed.services ? parsed.services : {},
      };
    } catch (error) {
      throw buildError('SECURE_STORE_READ_FAILED', 'Failed to read secure store.', error);
    }
  }

  writeDiskStore(store) {
    if (!this.storePath) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
      fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2));
    } catch (error) {
      throw buildError('SECURE_STORE_WRITE_FAILED', 'Failed to persist secure store.', error);
    }
  }

  getServiceRecords(store) {
    if (!store.services[this.serviceName] || typeof store.services[this.serviceName] !== 'object') {
      store.services[this.serviceName] = {};
    }

    return store.services[this.serviceName];
  }

  serializeSecret(secret) {
    this.ensureEncryptionAvailable();

    if (this.canEncrypt()) {
      return {
        scheme: 'safe-storage',
        value: this.encryption.encryptString(secret).toString('base64'),
      };
    }

    return {
      scheme: 'plain',
      value: secret,
    };
  }

  deserializeSecret(record) {
    if (!record) {
      return '';
    }

    if (typeof record === 'string') {
      return record;
    }

    if (record.scheme === 'safe-storage') {
      if (!this.canEncrypt()) {
        throw buildError(
          'SECURE_STORAGE_UNAVAILABLE',
          'Secure storage is unavailable in the current environment.',
        );
      }

      try {
        return this.encryption.decryptString(Buffer.from(record.value, 'base64'));
      } catch (error) {
        throw buildError('SECURE_STORE_DECRYPT_FAILED', 'Failed to decrypt secure store item.', error);
      }
    }

    return String(record.value || '');
  }

  writeSecret(account, secret) {
    const serialized = this.serializeSecret(secret);

    if (!this.storePath) {
      this.memoryStore.set(account, serialized);
      return;
    }

    const store = this.readDiskStore();
    const serviceRecords = this.getServiceRecords(store);
    serviceRecords[account] = serialized;
    this.writeDiskStore(store);
  }

  readSecret(account) {
    if (!this.storePath) {
      return this.deserializeSecret(this.memoryStore.get(account));
    }

    const store = this.readDiskStore();
    const serviceRecords = this.getServiceRecords(store);
    return this.deserializeSecret(serviceRecords[account]);
  }

  removeSecret(account) {
    if (!this.storePath) {
      this.memoryStore.delete(account);
      return;
    }

    const store = this.readDiskStore();
    const serviceRecords = this.getServiceRecords(store);
    delete serviceRecords[account];
    this.writeDiskStore(store);
  }

  createRef(account) {
    return `keychain://inspiradb/${account}`;
  }

  upsertSecret({ ref, secret }) {
    const value = String(secret || '').trim();
    if (!value) {
      throw buildError('EMPTY_SECRET', 'API key is empty.');
    }

    const parsed = parseRef(ref);
    const account = parsed?.account || `zhipu-${randomUUID()}`;
    this.writeSecret(account, value);
    return this.createRef(account);
  }

  getSecret(ref) {
    const parsed = parseRef(ref);
    if (!parsed) {
      return '';
    }

    if (parsed.type === 'legacy-inline') {
      return parsed.legacySecret;
    }

    return this.readSecret(parsed.account);
  }

  deleteSecret(ref) {
    const parsed = parseRef(ref);
    if (!parsed || parsed.type === 'legacy-inline') {
      return;
    }

    try {
      this.removeSecret(parsed.account);
    } catch {
      // 删除失败时忽略，防止设置保存被阻断。
    }
  }
}

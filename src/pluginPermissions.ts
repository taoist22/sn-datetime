import {PluginManager} from 'sn-plugin-lib';

export const FILE_READ_PERMISSION = 'plugin.permission.FILE:READ';
export const FILE_WRITE_PERMISSION = 'plugin.permission.FILE:WRITE';

const pendingRequests = new Map<string, Promise<boolean>>();

const ensurePluginPermission = async (
  permission: string,
  description: string,
): Promise<boolean> => {
  const manager = PluginManager as typeof PluginManager & {
    hasPermission?: (name: string) => Promise<number>;
    requestPermission?: (name: string, desc?: string) => Promise<number>;
  };

  // Older beta firmware did not expose permission APIs.
  if (
    typeof manager.hasPermission !== 'function' ||
    typeof manager.requestPermission !== 'function'
  ) {
    return true;
  }

  const existing = pendingRequests.get(permission);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      if (Number(await manager.hasPermission!(permission)) > 0) {
        return true;
      }
      return (
        Number(await manager.requestPermission!(permission, description)) > 0
      );
    } catch {
      return false;
    }
  })();

  pendingRequests.set(permission, request);
  try {
    return await request;
  } finally {
    pendingRequests.delete(permission);
  }
};

// Non-throwing: for callers where read access only buys a nicety, so denying
// it degrades that nicety instead of failing the stamp.
export const requestFileReadPermission = () =>
  ensurePluginPermission(
    FILE_READ_PERMISSION,
    'Allow DateTimeStamp to read selected font files and check existing date keywords.',
  );

export const requireFileReadPermission = async () => {
  if (!(await requestFileReadPermission())) {
    throw new Error(
      'File read access was not allowed. Grant access to choose a font file.',
    );
  }
};

export const requireFileWritePermission = async () => {
  const allowed = await ensurePluginPermission(
    FILE_WRITE_PERMISSION,
    'Allow DateTimeStamp to insert a stamp and optional date keyword into the current note.',
  );
  if (!allowed) {
    throw new Error('File write access was not allowed. Grant access to insert a stamp.');
  }
};

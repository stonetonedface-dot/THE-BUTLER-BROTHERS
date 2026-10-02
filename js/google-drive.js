const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const MODEL_EXTENSION = /\.(glb|gltf|fbx)$/i;
const COMPANION_EXTENSION = /\.(bin|png|jpe?g|webp|gif|bmp|tga|ktx2|dds)$/i;

export class GoogleDriveError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = 'GoogleDriveError';
    this.code = code;
    this.cause = cause;
  }
}

const waitForIdentityServices = () => new Promise((resolve, reject) => {
  if (window.google?.accounts?.oauth2) return resolve(window.google);
  const script = document.querySelector('script[data-google-identity]');
  if (!script) return reject(new GoogleDriveError('GIS_UNAVAILABLE', 'GOOGLE IDENTITY SERVICES COULD NOT LOAD.'));

  let settled = false;
  const finishWithError = () => {
    if (settled) return;
    settled = true;
    window.clearInterval(checkReady);
    reject(new GoogleDriveError('GIS_UNAVAILABLE', 'GOOGLE IDENTITY SERVICES COULD NOT LOAD.'));
  };
  const finish = () => {
    if (settled || !window.google?.accounts?.oauth2) return;
    settled = true;
    window.clearInterval(checkReady);
    resolve(window.google);
  };
  const checkReady = window.setInterval(finish, 100);
  script.addEventListener('load', finish, { once: true });
  script.addEventListener('error', finishWithError, { once: true });
  window.setTimeout(finishWithError, 12000);
});

const errorFromResponse = async (response) => {
  const payload = await response.json().catch(() => null);
  const reasons = payload?.error?.errors?.map((entry) => entry.reason) || [];
  const message = payload?.error?.message || response.statusText;
  if (response.status === 401) return new GoogleDriveError('NOT_CONNECTED', 'GOOGLE DRIVE NOT CONNECTED.');
  if (response.status === 403 && (reasons.includes('accessNotConfigured') || /has not been used|not enabled/i.test(message))) {
    return new GoogleDriveError('API_DISABLED', 'GOOGLE DRIVE API IS NOT ENABLED FOR THIS OAUTH PROJECT.');
  }
  if (response.status === 403) return new GoogleDriveError('ACCESS_DENIED', 'GOOGLE DRIVE ACCESS DENIED.');
  return new GoogleDriveError('REQUEST_FAILED', message || 'GOOGLE DRIVE REQUEST FAILED.');
};

const escapeDriveQuery = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const isDriveModel = (file) => MODEL_EXTENSION.test(file.name || '');

export class GoogleDriveClient {
  constructor(clientId) {
    this.clientId = clientId;
    this.accessToken = null;
    this.account = null;
  }

  get connected() {
    return Boolean(this.accessToken);
  }

  async connect() {
    const google = await waitForIdentityServices();
    return new Promise((resolve, reject) => {
      let completed = false;
      const finish = (handler, value) => {
        if (completed) return;
        completed = true;
        handler(value);
      };
      const fail = (error) => finish(reject, error instanceof GoogleDriveError
        ? error
        : new GoogleDriveError('AUTH_FAILED', 'GOOGLE AUTHORIZATION FAILED.', error));

      let tokenClient;
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: this.clientId,
          scope: DRIVE_SCOPE,
          callback: async (response) => {
            if (response?.error || !response?.access_token) return fail(new GoogleDriveError('AUTH_FAILED', 'GOOGLE AUTHORIZATION FAILED.', response));
            this.accessToken = response.access_token;
            try {
              this.account = await this.getAccount();
            } catch (error) {
              // Имя аккаунта — дополнительная деталь интерфейса. Токен остаётся
              // пригодным для просмотра Drive, даже если endpoint about недоступен.
              this.account = { name: '', email: '' };
            }
            finish(resolve, this.account);
          },
          error_callback: (error) => fail(new GoogleDriveError('AUTH_FAILED', 'GOOGLE AUTHORIZATION FAILED.', error)),
        });
        tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
      } catch (error) {
        fail(error);
      }
    });
  }

  async request(path) {
    if (!this.accessToken) throw new GoogleDriveError('NOT_CONNECTED', 'GOOGLE DRIVE NOT CONNECTED.');
    let response;
    try {
      response = await fetch(`${DRIVE_API}${path}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
    } catch (error) {
      throw new GoogleDriveError('NETWORK_BLOCKED', 'GOOGLE DRIVE REQUEST WAS BLOCKED. CHECK THE CONNECTION, BROWSER POLICY OR DRIVE PERMISSIONS.', error);
    }
    if (!response.ok) throw await errorFromResponse(response);
    return response;
  }

  async getAccount() {
    const response = await this.request('/about?fields=user(displayName,emailAddress)');
    const { user = {} } = await response.json();
    return { name: user.displayName || '', email: user.emailAddress || '' };
  }

  async listFolderContents(folderId = 'root') {
    const files = [];
    let pageToken = '';
    do {
      const query = new URLSearchParams({
        q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
        orderBy: 'folder,name',
        pageSize: '100',
        spaces: 'drive',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) query.set('pageToken', pageToken);
      const response = await this.request(`/files?${query.toString()}`);
      const payload = await response.json();
      files.push(...(payload.files || []));
      pageToken = payload.nextPageToken || '';
    } while (pageToken);

    return {
      folders: files.filter((file) => file.mimeType === FOLDER_MIME_TYPE),
      models: files.filter(isDriveModel),
      assets: files,
    };
  }

  async downloadFile(file, onProgress = null) {
    const query = new URLSearchParams({ alt: 'media', supportsAllDrives: 'true' });
    const response = await this.request(`/files/${encodeURIComponent(file.id)}?${query.toString()}`);
    const total = Number(response.headers.get('content-length')) || 0;
    if (!response.body) {
      const blob = await response.blob();
      onProgress?.(blob.size, total || blob.size);
      return new File([blob], file.name, { type: file.mimeType || blob.type });
    }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, total);
    }
    const blob = new Blob(chunks, { type: file.mimeType || 'application/octet-stream' });
    return new File([blob], file.name, { type: blob.type });
  }

  async downloadModelBundle(model, folderAssets, onProgress = null) {
    const files = [await this.downloadFile(model, onProgress)];
    if (!/\.(gltf|fbx)$/i.test(model.name)) return files;

    const companions = folderAssets.filter((file) => file.id !== model.id && (COMPANION_EXTENSION.test(file.name || '') || file.mimeType?.startsWith('image/')));
    for (const asset of companions) files.push(await this.downloadFile(asset));
    return files;
  }
}

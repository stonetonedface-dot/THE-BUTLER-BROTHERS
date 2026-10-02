const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GLB_EXTENSION = /\.glb$/i;

export class PublicDriveError extends Error {
  constructor(code, message, cause = null) {
    super(message);
    this.name = 'PublicDriveError';
    this.code = code;
    this.cause = cause;
  }
}

const isGoogleDriveHost = (hostname) => hostname === 'drive.google.com' || hostname.endsWith('.drive.google.com');

const resourceKeyHeaders = (file) => file?.resourceKey
  ? { 'X-Goog-Drive-Resource-Keys': `${file.id}/${file.resourceKey}` }
  : {};

const errorFromResponse = async (response, action) => {
  const payload = await response.json().catch(() => null);
  const message = payload?.error?.message || '';
  if (response.status === 404) return new PublicDriveError('FOLDER_UNAVAILABLE', 'Папка недоступна.');
  if (response.status === 401 || response.status === 403) {
    if (/api key|referer|referrer/i.test(message)) return new PublicDriveError('API_KEY_REJECTED', 'Не удалось получить содержимое папки.');
    return new PublicDriveError('FOLDER_NOT_PUBLIC', 'Папка не является публичной.');
  }
  return new PublicDriveError(action === 'download' ? 'MODEL_LOAD_FAILED' : 'LIST_FAILED', action === 'download' ? 'Не удалось загрузить модель.' : 'Не удалось получить содержимое папки.');
};

const request = async (path, apiKey, parameters = {}, headers = {}, action = 'list') => {
  if (!apiKey) throw new PublicDriveError('API_KEY_MISSING', 'Ключ Google Drive API не настроен.');
  const url = new URL(`${DRIVE_API}${path}`);
  Object.entries({ ...parameters, key: apiKey }).forEach(([name, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(name, String(value));
  });
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    throw new PublicDriveError(action === 'download' ? 'MODEL_LOAD_FAILED' : 'LIST_FAILED', action === 'download' ? 'Не удалось загрузить модель.' : 'Не удалось получить содержимое папки.', error);
  }
  if (!response.ok) throw await errorFromResponse(response, action);
  return response;
};

export const extractPublicFolderLink = (value) => {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new PublicDriveError('INVALID_FOLDER_URL', 'Это не ссылка на Google Drive папку.');
  }

  if (!/^https:$/.test(url.protocol) || !isGoogleDriveHost(url.hostname)) {
    throw new PublicDriveError('INVALID_FOLDER_URL', 'Это не ссылка на Google Drive папку.');
  }

  const folderMatch = url.pathname.match(/\/(?:drive\/(?:u\/\d+\/)?folders|folders)\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) {
    return {
      id: folderMatch[1],
      resourceKey: url.searchParams.get('resourcekey') || '',
    };
  }
  throw new PublicDriveError('FOLDER_ID_MISSING', 'Не удалось определить ID папки.');
};

export const extractPublicFolderId = (value) => extractPublicFolderLink(value).id;

const getFolder = async (folder, apiKey) => {
  const response = await request(
    `/files/${encodeURIComponent(folder.id)}`,
    apiKey,
    { fields: 'id,name,mimeType,resourceKey', supportsAllDrives: 'true' },
    resourceKeyHeaders(folder),
    'folder',
  );
  const metadata = await response.json();
  if (metadata.mimeType !== FOLDER_MIME_TYPE) throw new PublicDriveError('INVALID_FOLDER_URL', 'Это не ссылка на Google Drive папку.');
  return metadata;
};

export const listPublicGlbModels = async (folderLink, apiKey) => {
  const folder = await getFolder(folderLink, apiKey);
  const files = [];
  let pageToken = '';
  do {
    const response = await request(
      '/files',
      apiKey,
      {
        q: `'${folder.id.replace(/'/g, "\\'")}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,resourceKey,capabilities/canDownload)',
        orderBy: 'name_natural',
        pageSize: '100',
        pageToken,
        spaces: 'drive',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      },
      resourceKeyHeaders(folder),
      'list',
    );
    const payload = await response.json();
    files.push(...(payload.files || []));
    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return {
    folder,
    models: files.filter((file) => GLB_EXTENSION.test(file.name || '') && file.capabilities?.canDownload !== false),
  };
};

export const downloadPublicGlb = async (model, apiKey) => {
  const response = await request(
    `/files/${encodeURIComponent(model.id)}`,
    apiKey,
    { alt: 'media', supportsAllDrives: 'true' },
    resourceKeyHeaders(model),
    'download',
  );
  const blob = await response.blob();
  return new File([blob], model.name, { type: model.mimeType || 'model/gltf-binary' });
};

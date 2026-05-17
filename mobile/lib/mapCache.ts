import * as FileSystem from 'expo-file-system/legacy';

const TILE_ROOT = `${FileSystem.documentDirectory}tiles/`;

// Oton Bounding Box
export const OTON_BBOX = {
  minLat: 10.606,
  maxLat: 10.771,
  minLon: 122.420,
  maxLon: 122.524,
};

export const getTileUrl = (x: number, y: number, z: number) => {
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
};

export const getLocalTilePath = (x: number, y: number, z: number) => {
  return `${TILE_ROOT}${z}/${x}/${y}.png`;
};

// Degrees to Tile coordinates
const lon2tile = (lon: number, zoom: number) => {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
};

const lat2tile = (lat: number, zoom: number) => {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom)
  );
};

export const downloadOtonTiles = async (
  onProgress: (progress: number, total: number) => void
) => {
  const zoomLevels = [12, 13, 14, 15]; // Higher levels = more data. 16 is slow but detailed.
  let totalToDownload = 0;
  const tilesToDownload: { x: number; y: number; z: number }[] = [];

  // Calculate tiles
  zoomLevels.forEach((z) => {
    const xMin = lon2tile(OTON_BBOX.minLon, z);
    const xMax = lon2tile(OTON_BBOX.maxLon, z);
    const yMin = lat2tile(OTON_BBOX.maxLat, z);
    const yMax = lat2tile(OTON_BBOX.minLat, z);

    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tilesToDownload.push({ x, y, z });
      }
    }
  });

  totalToDownload = tilesToDownload.length;
  let downloadedCount = 0;

  for (const tile of tilesToDownload) {
    const { x, y, z } = tile;
    const localPath = getLocalTilePath(x, y, z);
    const directory = `${TILE_ROOT}${z}/${x}/`;

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(directory);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    }

    // Check if tile already exists
    const tileInfo = await FileSystem.getInfoAsync(localPath);
    if (!tileInfo.exists) {
      try {
        await FileSystem.downloadAsync(getTileUrl(x, y, z), localPath);
      } catch (e) {
        console.error(`Failed to download tile ${z}/${x}/${y}`, e);
      }
    }

    downloadedCount++;
    onProgress(downloadedCount, totalToDownload);
  }
};

export const clearTileCache = async () => {
  const info = await FileSystem.getInfoAsync(TILE_ROOT);
  if (info.exists) {
    await FileSystem.deleteAsync(TILE_ROOT);
  }
};

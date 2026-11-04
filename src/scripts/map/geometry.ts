/** Geometry is cached across every map shell on the page. */
const geometryCache = new Map<string, Promise<any>>();

export const fetchGeometry = (geometryRef: string): Promise<any[]> => {
  const [path, featureId] = geometryRef.split('#');
  const url = path.startsWith('/') ? path : `/${path}`;

  let request = geometryCache.get(url);
  if (!request) {
    request = fetch(url, { signal: AbortSignal.timeout(12000) })
      .then((response) => {
        if (!response.ok) throw new Error(`Geometry request failed: ${url}`);
        return response.json();
      })
      .catch((error) => {
        geometryCache.delete(url);
        throw error;
      });
    geometryCache.set(url, request);
  }

  return request.then((collection: any) => {
    const features: any[] = collection.features ?? [];
    if (!featureId) return features;
    return features.filter(
      (feature) =>
        String(feature.id) === featureId ||
        String(feature.properties?.id) === featureId,
    );
  });
};

export async function get(data, bungiekey: string) {
  const url = new URL(`https://www.bungie.net/Platform/${data.uri}`);
  // Normalize components as an array.
  if (data.components) {
    data.components = Array.isArray(data.components)
      ? data.components
      : [data.components];
    url.searchParams.set("components", data.components.join(","));
  }
  try {
    const response = await fetch(url.toString(), {
      headers: { "X-API-Key": bungiekey }
    });
    return await response.json();
  } catch (error) {
    throw error;
  }
}

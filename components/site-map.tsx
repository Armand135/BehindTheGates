/**
 * Zero-config site-location map using OpenStreetMap's embeddable iframe —
 * no API key required, unlike Mapbox/Google Maps (Technical Brief Section
 * 5 names either as an option). Swap this out if/when a Mapbox or Google
 * Maps API key is available.
 */
export function SiteMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const delta = 0.01;
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-brand-100">
      <iframe
        title={`Map of ${label}`}
        src={src}
        className="h-64 w-full"
        loading="lazy"
      />
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
        target="_blank"
        rel="noreferrer"
        className="block bg-white px-3 py-1.5 text-xs text-brand-600 hover:underline"
      >
        View larger map
      </a>
    </div>
  );
}

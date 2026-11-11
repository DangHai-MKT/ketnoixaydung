const thumbnailWidths = { small: 160, card: 400, large: 800 } as const;

export function projectThumbnailWidth(value: string | null) {
  return value && Object.hasOwn(thumbnailWidths, value)
    ? thumbnailWidths[value as keyof typeof thumbnailWidths]
    : undefined;
}

export function projectThumbnailUrl(url: string, size: keyof typeof thumbnailWidths) {
  return `${url}?thumbnail=${size}`;
}

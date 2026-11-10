export const projectFileExtensions: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export function validProjectFileType(mime: string, access: string) {
  return Object.hasOwn(projectFileExtensions, mime)
    && (access === 'purchased_only' || access === 'moderator_only' || (access === 'public_preview' && mime === 'image/png'));
}

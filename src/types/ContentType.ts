export const contentTypes = {
  html: 'text/html',
  json: 'application/json',
  js: 'application/javascript',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  file: 'application/octet-stream',
} as const;

export type ContentType = (typeof contentTypes)[keyof typeof contentTypes];

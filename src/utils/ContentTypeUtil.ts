import { ContentType, contentTypes } from '../types/ContentType';

export class ContentTypeUtil {
  static getContentType(filePath: string): ContentType {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'html':
        return contentTypes.html;
      case 'js':
        return contentTypes.js;
      case 'json':
        return contentTypes.json;
      case 'png':
        return contentTypes.png;
      case 'svg':
        return contentTypes.svg;
      case 'txt':
        return contentTypes.txt;
      case 'file':
        return contentTypes.file;
      default:
        return contentTypes.file;
    }
  }
}

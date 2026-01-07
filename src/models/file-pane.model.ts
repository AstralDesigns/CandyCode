export type FilePaneType = 
  | 'code' 
  | 'markdown' 
  | 'pdf' 
  | 'word' 
  | 'excel' 
  | 'powerpoint' 
  | 'onenote'
  | 'image-gallery' 
  | 'video-gallery';

export interface FilePane {
  id: string; // File path or unique ID for untitled files
  name: string;
  type: FilePaneType;
  content: string; // For code/markdown files
  language?: string; // Monaco editor language
  isUnsaved: boolean;
  data?: any; // For galleries, contains array of FileSystemItem
}

export interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
}


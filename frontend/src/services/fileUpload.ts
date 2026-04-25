import { apiAdapterManager } from '../data/apiAdapter';

export interface UploadedFileResponse {
  id: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  created_at: string;
}

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document' | 'other';
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.md'];
const BLOCKED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.ws', '.sh', '.ps1'];

class FileUploadService {
  private validateFile(file: File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`文件 ${file.name} 超过 10MB 限制`);
    }

    if (file.size === 0) {
      throw new Error(`文件 ${file.name} 为空`);
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (BLOCKED_EXTENSIONS.includes(extension || '')) {
      throw new Error(`不允许上传 ${extension} 类型的文件`);
    }

    if (!ALLOWED_EXTENSIONS.includes(extension || '')) {
      throw new Error(`不支持的文件类型: ${extension}`);
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`不支持的文件 MIME 类型: ${file.type}`);
    }
  }

  async uploadFile(file: File): Promise<UploadedFileResponse> {
    this.validateFile(file);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token') || '';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: '上传失败' }));
        throw new Error(error.detail || '文件上传失败');
      }

      const data = await response.json();
      return data as UploadedFileResponse;
    } catch (error) {
      console.error('File upload error:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(files: File[]): Promise<UploadedFileResponse[]> {
    const results: UploadedFileResponse[] = [];
    const errors: string[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file);
        results.push(result);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : '未知错误');
      }
    }

    if (errors.length > 0) {
      console.warn('Some files failed to upload:', errors);
    }

    return results;
  }

  generatePreview(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  getFileType(file: File): 'image' | 'document' | 'other' {
    if (file.type.startsWith('image/')) {
      return 'image';
    }
    if (
      file.type.startsWith('text/') ||
      file.type.includes('pdf') ||
      file.type.includes('word') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
    ) {
      return 'document';
    }
    return 'other';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const fileUploadService = new FileUploadService();

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image, FileText, X, Loader2, CheckCircle, Trash2, ZoomIn } from 'lucide-react';
import { useToast } from '../Toast';

interface UploadedFile {
  file_id: string;
  filename: string;
  file_type: 'image' | 'document';
  file_size: number;
  url: string;
  analysis?: ImageAnalysis;
  preview?: string;
}

interface ImageAnalysis {
  media_type: string;
  category?: string;
  description?: string;
  entities?: Array<{ name: string; type: string }>;
  tags?: string[];
  confidence?: number;
  ocr_text?: string;
  colors?: string[];
  style?: string;
}

interface FileUploadProps {
  onUploadComplete: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  maxFiles?: number;
  acceptedTypes?: string;
  disabled?: boolean;
}

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/gif,image/webp';
const ACCEPTED_DOCUMENT_TYPES =
  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function FileUpload({
  onUploadComplete,
  onUploadError,
  maxFiles = 5,
  acceptedTypes = `${ACCEPTED_IMAGE_TYPES},${ACCEPTED_DOCUMENT_TYPES}`,
  disabled = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      if (file.size > MAX_FILE_SIZE) {
        return { valid: false, error: `文件 "${file.name}" 超过10MB限制` };
      }

      const acceptedTypesList = acceptedTypes.split(',');
      if (!acceptedTypesList.includes(file.type)) {
        return { valid: false, error: `文件类型 "${file.type}" 不支持` };
      }

      return { valid: true };
    },
    [acceptedTypes]
  );

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const isImage = file.type.startsWith('image/');
    const endpoint = isImage
      ? '/api/v1/multimodal/upload/image'
      : '/api/v1/multimodal/upload/document';

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || '上传失败');
    }

    const data = await response.json();

    let preview: string | undefined;
    if (isImage) {
      preview = URL.createObjectURL(file);
    }

    return {
      ...data,
      preview,
    };
  };

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      if (disabled || uploading) return;

      const fileArray = Array.from(fileList);

      if (files.length + fileArray.length > maxFiles) {
        toast.error('文件数量超限', `最多上传${maxFiles}个文件`);
        return;
      }

      const validationErrors: string[] = [];
      const validFiles: File[] = [];

      for (const file of fileArray) {
        const validation = validateFile(file);
        if (validation.valid) {
          validFiles.push(file);
        } else {
          validationErrors.push(validation.error ?? '未知错误');
        }
      }

      if (validationErrors.length > 0) {
        toast.error('文件验证失败', validationErrors[0]);
      }

      if (validFiles.length === 0) return;

      setUploading(true);

      try {
        const uploadPromises = validFiles.map(uploadFile);
        const uploadedFiles = await Promise.all(uploadPromises);

        setFiles((prev) => [...prev, ...uploadedFiles]);
        onUploadComplete(uploadedFiles);

        toast.success('上传成功', `已上传${uploadedFiles.length}个文件`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '上传失败';
        toast.error('上传失败', errorMsg);
        onUploadError?.(errorMsg);
      } finally {
        setUploading(false);
      }
    },
    [
      disabled,
      uploading,
      files.length,
      maxFiles,
      onUploadComplete,
      onUploadError,
      toast,
      validateFile,
    ]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const file = prev.find((f) => f.file_id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.file_id !== fileId);
    });
  }, []);

  const clearAll = useCallback(() => {
    files.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setFiles([]);
  }, [files]);

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedTypes}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      <motion.div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`
          relative border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all
          ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <AnimatePresence>
          {dragActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-blue-500/20 rounded-xl flex items-center justify-center"
            >
              <div className="text-blue-500 font-medium">释放文件以上传</div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Upload className="w-6 h-6 text-white" />
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {uploading ? '正在上传...' : '拖拽文件到此处或点击上传'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              支持图片(JPEG, PNG, GIF, WebP)和文档(PDF, DOC, TXT)，最大10MB
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                已上传 {files.length}/{maxFiles} 个文件
              </span>
              <button
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                清空全部
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {files.map((file) => (
                <motion.div
                  key={file.file_id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="relative group bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden"
                >
                  {file.file_type === 'image' ? (
                    <div className="aspect-square relative">
                      {file.preview ? (
                        <img
                          src={file.preview}
                          alt={file.filename}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                          <Image className="w-8 h-8 text-gray-400" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                          <ZoomIn className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={() => removeFile(file.file_id)}
                          className="p-2 bg-white/20 rounded-full hover:bg-red-500/50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-white" />
                        </button>
                      </div>

                      {file.analysis && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="w-4 h-4 text-green-500 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-square flex flex-col items-center justify-center p-3">
                      <FileText className="w-10 h-10 text-blue-500 mb-2" />
                      <p className="text-xs text-center text-gray-600 dark:text-gray-400 truncate w-full">
                        {file.filename}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.file_size)}</p>

                      <button
                        onClick={() => removeFile(file.file_id)}
                        className="absolute top-1 right-1 p-1 bg-gray-200 dark:bg-gray-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-4xl w-full bg-white dark:bg-gray-900 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewFile(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>

              <div className="flex flex-col md:flex-row">
                <div className="md:w-2/3 bg-gray-100 dark:bg-gray-800">
                  {previewFile.preview && (
                    <img
                      src={previewFile.preview}
                      alt={previewFile.filename}
                      className="w-full h-auto max-h-[70vh] object-contain"
                    />
                  )}
                </div>

                <div className="md:w-1/3 p-6 space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {previewFile.filename}
                    </h3>
                    <p className="text-sm text-gray-500">{formatFileSize(previewFile.file_size)}</p>
                  </div>

                  {previewFile.analysis && (
                    <>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          智能分析
                        </h4>

                        {previewFile.analysis.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {previewFile.analysis.description}
                          </p>
                        )}

                        {previewFile.analysis.tags && previewFile.analysis.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {previewFile.analysis.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {previewFile.analysis.entities &&
                          previewFile.analysis.entities.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500">识别实体:</p>
                              {previewFile.analysis.entities.map((entity, i) => (
                                <div key={i} className="text-sm text-gray-700 dark:text-gray-300">
                                  • {entity.name} ({entity.type})
                                </div>
                              ))}
                            </div>
                          )}

                        {previewFile.analysis.colors && previewFile.analysis.colors.length > 0 && (
                          <div className="flex gap-1 mt-3">
                            {previewFile.analysis.colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full border border-gray-300"
                                style={{ backgroundColor: color }}
                                title={color}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

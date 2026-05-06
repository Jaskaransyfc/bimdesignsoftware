"use client";

import { useState } from "react";
import { X, Upload, Loader } from "lucide-react";

interface FurnitureModelImportProps {
  projectId: string;
  onImportSuccess?: () => void;
}

export default function FurnitureModelImport({
  projectId,
  onImportSuccess,
}: FurnitureModelImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [modelType, setModelType] = useState("custom");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const ext = selectedFile.name.toLowerCase().split(".").pop();
      const supported = [
        "glb",
        "gltf",
        "obj",
        "fbx",
        "dxf",
        "dwg",
        "dwf",
        "mtl",
        "ifc",
        "rvt",
        "rfa",
        "stp",
        "step",
        "dae",
        "stl",
        "3ds",
        "max",
        "skp",
        "blend",
      ];

      if (!supported.includes(ext || "")) {
        setError(
          `❌ File type .${ext} is not supported.\n\nSupported formats: ${supported.map((e) => `.${e}`).join(", ")}`,
        );
        setFile(null);
        return;
      }

      // Add warning for DWG/DWF files
      if (["dwg", "dwf"].includes(ext || "")) {
        setError(
          `✓ File selected: ${selectedFile.name}\n\n⚠️ ${ext?.toUpperCase()} files have limited 3D visualization. For best results, export from AutoCAD as .obj or .gltf\n\nYou can still upload to proceed.`,
        );
        setFile(selectedFile);
      } else if (ext === "dxf") {
        setError(
          `✓ File selected: ${selectedFile.name}\n\n⚠️ DXF files have limited visualization support. GLTF/OBJ export recommended.\n\nYou can still upload to proceed.`,
        );
        setFile(selectedFile);
      } else {
        setError(null);
        setFile(selectedFile);
      }

      const fileSizeMB = selectedFile.size / (1024 * 1024);
      if (fileSizeMB > 50) {
        setError(
          `❌ File size is ${fileSizeMB.toFixed(2)}MB. Maximum 50MB allowed`,
        );
        setFile(null);
        return;
      }

      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("❌ Please select a file");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model_type", modelType);

      // Use XMLHttpRequest for progress tracking
      // Upload directly to backend to bypass Next.js 10MB proxy limit
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          setSuccess(true);
          setFile(null);
          setTimeout(() => {
            setSuccess(false);
            setIsOpen(false);
            onImportSuccess?.();
          }, 2000);
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            setError(
              `❌ Upload failed: ${errorData.detail || "Unknown error"}`,
            );
          } catch {
            setError(`❌ Upload failed with status ${xhr.status}`);
          }
          setIsUploading(false);
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setError(
          "❌ Network error during upload. Please check your connection.",
        );
        setIsUploading(false);
      });

      xhr.addEventListener("abort", () => {
        setError("❌ Upload cancelled");
        setIsUploading(false);
      });

      // Send request directly to backend
      xhr.open(
        "POST",
        `${backendUrl}/api/projects/${projectId}/models/upload?model_type=${modelType}`,
      );
      xhr.send(formData);
    } catch (err) {
      setError(`❌ ${err instanceof Error ? err.message : "Upload failed"}`);
      setIsUploading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-sm font-medium transition"
      >
        <Upload size={16} />
        Import 3D Model
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Import 3D Model</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-slate-700 rounded"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-900 border border-green-700 text-green-200 rounded">
            ✓ Model imported successfully!
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              3D Model File
            </label>
            <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center hover:border-slate-500 transition">
              <input
                type="file"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="hidden"
                id="file-input"
              />
              <label htmlFor="file-input" className="cursor-pointer">
                {file ? (
                  <div className="text-slate-300">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-400">
                    <p className="text-sm">Drop file here or click to select</p>
                    <p className="text-xs mt-1">
                      Supported: .glb, .gltf, .obj, .fbx, .dxf, .dwg, .dwf (max
                      50MB)
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Model Type */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Furniture Type
            </label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              disabled={isUploading}
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="custom">Custom</option>
              <option value="chair">Chair</option>
              <option value="sofa">Sofa</option>
              <option value="table">Table</option>
              <option value="bed">Bed</option>
              <option value="cabinet">Cabinet</option>
              <option value="tv">TV</option>
              <option value="desk">Desk</option>
            </select>
          </div>

          {/* Upload Progress */}
          {isUploading && uploadProgress > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-300">Uploading...</span>
                <span className="text-xs text-slate-400">
                  {uploadProgress}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={() => {
                setIsOpen(false);
                setFile(null);
                setError(null);
              }}
              disabled={isUploading}
              className="flex-1 px-4 py-2 rounded border border-slate-600 text-slate-300 hover:bg-slate-700 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

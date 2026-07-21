import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  endpoint?: string;
  fieldName?: string;
}

export function ImageUpload({
  value,
  onChange,
  endpoint = "/api/admin/uploads/image",
  fieldName = "image",
}: ImageUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    const formData = new FormData();
    formData.append(fieldName, file);

    try {
      setUploading(true);
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(res.data.url);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  if (value) {
    return (
      <div className="relative">
        <img
          src={value}
          alt="Project"
          className="h-48 w-full rounded-lg object-cover border border-border"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
        >
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex h-48 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition ${
        dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />
      {uploading ? (
        <>
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-ink-500">Uploading...</p>
        </>
      ) : (
        <>
          <ImagePlus size={28} className="text-ink-400" />
          <p className="text-sm text-ink-600">Click or drag an image to upload</p>
          <p className="text-xs text-ink-400">PNG, JPG, WEBP up to 5MB</p>
        </>
      )}
    </div>
  );
}

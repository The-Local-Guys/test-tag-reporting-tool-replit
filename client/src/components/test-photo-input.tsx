import { useEffect, useId, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { compressTestPhoto } from '@/lib/test-photo';

export function TestPhotoInput({ value, onChange, disabled, onProcessingChange }: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled: boolean;
  onProcessingChange: (value: boolean) => void;
}) {
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const processingRef = useRef(false);
  const helpId = useId();
  const busy = disabled || processing;
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  const processPhoto = async (file?: File) => {
    if (!file || disabled || processingRef.current) return;
    processingRef.current = true;
    const request = ++generation.current;
    setError('');
    setProcessing(true);
    onProcessingChange(true);
    try {
      const photo = await compressTestPhoto(file);
      if (request === generation.current) onChange(photo);
    } catch (error) {
      if (request === generation.current) setError((error as Error).message);
    } finally {
      processingRef.current = false;
      if (request === generation.current) {
        setProcessing(false);
        onProcessingChange(false);
      }
    }
  };

  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    void processPhoto(file);
  };

  return <fieldset disabled={busy} className="space-y-3" aria-busy={processing}>
    <legend className="mb-2 text-sm font-semibold text-gray-900">Failed item photo</legend>
    <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} className="hidden" aria-label="Choose photo from device" />
    <input ref={cameraInput} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectPhoto} className="hidden" aria-label="Take a photo" />
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (busy || !event.dataTransfer.types.includes('Files')) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        dragDepth.current = 0;
        setDragging(false);
        if (busy || processingRef.current) return;
        if (event.dataTransfer.files.length !== 1) {
          setError('Please drop one photo at a time.');
          return;
        }
        void processPhoto(event.dataTransfer.files[0]);
      }}
      className={`relative overflow-hidden rounded-xl border-2 border-dashed p-4 transition-colors ${dragging && !busy ? 'border-primary bg-primary/10' : 'border-gray-200 bg-gray-50/70'} ${busy ? 'opacity-70' : ''}`}
    >
      {value ? (
        <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <img src={value} alt="Failed item photo" draggable={false} className="max-h-56 w-full object-contain" />
        </div>
      ) : (
        <div className="mb-4 flex flex-col items-center pt-2 text-center">
          <span className="mb-3 rounded-full bg-white p-3 text-primary shadow-sm">
            <UploadCloud className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-gray-900">Add a photo of the failed item</p>
          <p className="mt-1 text-xs text-gray-500">Drag and drop here, or choose a photo below</p>
        </div>
      )}
      {value && <p className="mb-3 text-center text-xs text-gray-500">Drop a new photo here to replace this one</p>}
      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <Button type="button" variant="outline" className="min-h-11 bg-white" aria-describedby={helpId} onClick={() => galleryInput.current?.click()}>
          <ImagePlus aria-hidden="true" />{value ? 'Replace photo' : 'Choose photo'}
        </Button>
        <Button type="button" variant="outline" className="min-h-11 bg-white" onClick={() => cameraInput.current?.click()}>
          <Camera aria-hidden="true" />Take photo
        </Button>
      </div>
      {dragging && !busy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/95 text-sm font-semibold text-primary" role="status">Drop photo here</div>}
      {processing && <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white/95 text-sm font-medium text-gray-700" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Processing photo...</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p id={helpId} className="text-xs leading-5 text-gray-500">JPEG, PNG or WebP ? Up to 10 MB<br />One photo per item</p>
      {value && <Button type="button" variant="ghost" size="sm" className="min-h-11 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { setError(''); onChange(null); }}><Trash2 aria-hidden="true" />Remove</Button>}
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
  </fieldset>;
}

import { Eraser, PenLine } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sign with a finger, pen or mouse. Reports a PNG data URL, or null when
 * the box is empty. With a saved signature the person can use it as is.
 */
export function SignaturePad({
    onChange,
    savedSignatureUrl,
    error,
}: {
    onChange: (dataUrl: string | null) => void;
    savedSignatureUrl?: string | null;
    error?: string;
}) {
    const [useSaved, setUseSaved] = useState(Boolean(savedSignatureUrl));
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [empty, setEmpty] = useState(true);

    const prepare = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
        const context = canvas.getContext('2d');
        if (!context) return;
        context.scale(ratio, ratio);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.lineWidth = 2.2;
        context.strokeStyle = '#0f172a';
        setEmpty(true);
    }, []);

    useEffect(() => {
        if (!useSaved) prepare();
    }, [useSaved, prepare]);

    useEffect(() => {
        onChange(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useSaved]);

    const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        drawing.current = true;
        last.current = point(event);
        const context = event.currentTarget.getContext('2d');
        if (context && last.current) {
            context.beginPath();
            context.arc(last.current.x, last.current.y, 1, 0, Math.PI * 2);
            context.fillStyle = '#0f172a';
            context.fill();
        }
    };

    const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current || !last.current) return;
        const context = event.currentTarget.getContext('2d');
        const next = point(event);
        if (!context) return;
        context.beginPath();
        context.moveTo(last.current.x, last.current.y);
        context.lineTo(next.x, next.y);
        context.stroke();
        last.current = next;
        setEmpty(false);
    };

    const end = () => {
        if (!drawing.current) return;
        drawing.current = false;
        last.current = null;
        if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
        setEmpty(false);
    };

    const clear = () => {
        prepare();
        onChange(null);
    };

    if (useSaved && savedSignatureUrl) {
        return (
            <div className="grid gap-2">
                <div className="bg-background flex h-28 items-center justify-center rounded-xl border">
                    <img src={savedSignatureUrl} alt="Your saved signature" className="max-h-24 max-w-[80%] object-contain" />
                </div>
                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span>Your saved signature will be fixed to this request.</span>
                    <button type="button" className="text-primary inline-flex items-center gap-1 font-medium" onClick={() => setUseSaved(false)}>
                        <PenLine className="size-3.5" /> Sign by hand instead
                    </button>
                </div>
                {error && <span className="text-destructive text-xs">{error}</span>}
            </div>
        );
    }

    return (
        <div className="grid gap-2">
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    className="bg-background h-32 w-full cursor-crosshair touch-none rounded-xl border"
                    onPointerDown={start}
                    onPointerMove={move}
                    onPointerUp={end}
                    onPointerLeave={end}
                    aria-label="Signature box"
                />
                {empty && (
                    <span className="text-muted-foreground pointer-events-none absolute inset-0 flex items-center justify-center text-sm">
                        Sign here
                    </span>
                )}
                <div className="pointer-events-none absolute right-6 bottom-6 left-6 border-b border-dashed border-slate-300" />
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={clear}>
                    <Eraser className="size-3.5" /> Clear
                </button>
                {savedSignatureUrl && (
                    <button type="button" className="text-primary font-medium" onClick={() => setUseSaved(true)}>
                        Use my saved signature
                    </button>
                )}
            </div>
            {error && <span className="text-destructive text-xs">{error}</span>}
        </div>
    );
}

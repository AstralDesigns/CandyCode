import { useEffect, useRef } from 'react';

interface PDFCanvasProps {
  filePath: string;
}

export default function PDFCanvas({ filePath }: PDFCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create iframe for PDF viewing (like agentic-studio)
    const iframe = document.createElement('iframe');
    iframe.src = `file://${filePath}`;
    iframe.className = 'w-full h-full border-0';

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(iframe);

    // Fallback if iframe doesn't work
    iframe.onerror = () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-slate-400 p-8">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-lg font-semibold text-slate-300 mb-2">PDF Viewer</h3>
            <p class="text-sm text-center">PDF viewing is available. The file is located at:</p>
            <p class="text-xs text-slate-500 mt-2 font-mono break-all px-4">${filePath}</p>
          </div>
        `;
      }
    };
  }, [filePath]);

  return <div ref={containerRef} className="w-full h-full bg-slate-950" />;
}


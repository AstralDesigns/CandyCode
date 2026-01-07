import { useMemo } from 'react';
import { FileText } from 'lucide-react';

interface OfficeCanvasProps {
  filePath: string;
  documentType: 'word' | 'excel' | 'powerpoint' | 'onenote';
}

export default function OfficeCanvas({ filePath, documentType }: OfficeCanvasProps) {
  const fileName = useMemo(() => {
    return filePath.split('/').pop() || filePath;
  }, [filePath]);

  const documentTypeName = useMemo(() => {
    const names: Record<string, string> = {
      word: 'Word Document',
      excel: 'Excel Spreadsheet',
      powerpoint: 'PowerPoint Presentation',
      onenote: 'OneNote Notebook',
    };
    return names[documentType] || 'Office Document';
  }, [documentType]);

  return (
    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 bg-slate-950">
      <FileText className="h-16 w-16 mb-4 text-slate-600" />
      <h3 className="text-lg font-semibold text-slate-300 mb-2">{documentTypeName}</h3>
      <p className="text-sm text-center mb-4">{fileName}</p>
      <p className="text-xs text-slate-500 text-center max-w-md mb-2">
        Office file viewing via LibreOffice integration is planned.
        See <code className="text-xs bg-slate-800/50 px-1 py-0.5 rounded">docs/LIBREOFFICE_INTEGRATION.md</code> for implementation details.
      </p>
      <p className="text-xs text-slate-600 text-center max-w-md">
        Cross-platform support (Linux/macOS/Windows) using LibreOffice headless mode for conversion.
      </p>
      <p className="text-xs text-slate-600 mt-4 font-mono break-all px-4">{filePath}</p>
    </div>
  );
}


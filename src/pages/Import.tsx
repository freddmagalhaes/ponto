import { useState } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle } from 'lucide-react';

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Importar Registros AFV</h1>
        <p className="text-muted-foreground">Importe o arquivo do relógio de ponto para registrar as batidas de todos os funcionários automaticamente.</p>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="mt-8 border-2 border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 transition-colors rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer min-h-[300px]"
      >
        {!file ? (
          <>
            <UploadCloud className="w-16 h-16 text-primary/60 mb-4" />
            <h3 className="font-semibold text-lg">Arraste e solte o arquivo aqui</h3>
            <p className="text-sm text-muted-foreground mt-2">ou clique para procurar no seu computador</p>
            <p className="text-xs text-muted-foreground mt-4 font-mono select-all">Suporte a formatos .txt e .csv (Layout AFV)</p>
          </>
        ) : (
          <>
            <FileType className="w-16 h-16 text-primary mb-4" />
            <h3 className="font-bold text-xl">{file.name}</h3>
            <p className="text-sm text-muted-foreground mt-2">{(file.size / 1024).toFixed(2)} KB</p>
            
            <button 
              className="mt-8 bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-full shadow hover:bg-primary/90 flex items-center"
              onClick={(e) => { e.stopPropagation(); /* process file */ }}
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Processar Arquivo
            </button>
          </>
        )}
      </div>

      <div className="bg-destructive/10 border border-destructive/20 text-destructive/90 rounded-xl p-4 flex gap-3 mt-8">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <div>
          <h4 className="font-semibold">Notas sobre a importação</h4>
          <p className="text-sm mt-1 opacity-90">O sistema fará o vínculo automático do número PIS/CPF contido no arquivo com o cadastro de funcionários. Funcionários não encontrados gerarão um relatório de pendência para cadastro manual.</p>
        </div>
      </div>
    </div>
  );
}

##########################################
### Pulling data from origin/mainimport { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ProductionRecord, ProductionFormData } from "@/types/production";

// 🔗 URL de Produção
const API_URL = "https://nodered-vojorge.fsk.tec.br/api/producao";

export function useProductionRecords() {
  const [records, setRecords] = useState<ProductionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // --- BUSCAR DADOS (GET) ---
  const fetchRecords = async () => {
    try {
      // 🚀 SEGREDO: ?t=agora quebra o cache e atualiza a lista na hora
      const response = await fetch(`${API_URL}?t=${Date.now()}`);
      
      if (!response.ok) throw new Error("Falha na conexão");
      
      const rawData = await response.json();

      if (!Array.isArray(rawData)) {
        console.error("Recebido algo que não é lista:", rawData);
        return;
      }

      // Mapeamento Seguro
      const formattedData = rawData.map((item: any) => ({
        id: item.id,
        tipoFarinha: item.tipo_farinha || item.tipoFarinha || "Não informado", 
        data: item.data_registro || item.data || new Date().toISOString(),
        hora: item.hora_registro || item.hora || "00:00",
        umidade: Number(item.umidade || 0),
        forno: item.forno || "Geral",
        peneira: item.peneira || "Bica 1",
        responsavel: item.responsavel || "Sistema",
        foto: item.foto || null
      }));

      setRecords(formattedData);
    } catch (error) {
      console.error("Erro ao buscar:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- SALVAR DADOS (POST) ---
  const addRecord = async (formData: Omit<ProductionFormData, "usuario">) => {
    if (!user) {
      toast({ title: "Erro", description: "Você precisa estar logado.", variant: "destructive" });
      return false;
    }

    try {
      const payload = {
        ...formData,
        responsavel: user.name,
        usuario: user.name,
        data: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0]
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast({ 
          title: "Sucesso! 💾", 
          description: "Registro salvo no banco.",
          className: "bg-green-600 text-white border-none"
        });
        
        setTimeout(() => fetchRecords(), 1000); 
        return true;
      } else {
        throw new Error("Servidor recusou");
      }
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
      return false;
    }
  };

  // --- DELETAR (DELETE) ---
  const deleteRecord = async (id: number) => {
    try {
      await fetch(API_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      
      toast({ title: "Apagado", description: "Registro removido." });
      setTimeout(fetchRecords, 1000);
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 5000); 
    return () => clearInterval(interval);
  }, []);

  return { records, loading, addRecord, deleteRecord, refresh: fetchRecords };
}
### Tue, 03 Feb 2026 10:23:39 GMT
##########################################

Commit: Update useProductionRecords.tsx 
#0 building with "default" instance using docker driver

#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 681B done
#1 WARN: FromAsCasing: 'as' and 'FROM' keywords' casing do not match (line 2)
#1 DONE 0.0s

#2 [internal] load metadata for docker.io/library/node:20-alpine
#2 ...

#3 [internal] load metadata for docker.io/library/nginx:alpine
#3 DONE 0.9s

#2 [internal] load metadata for docker.io/library/node:20-alpine
#2 DONE 1.0s

#4 [internal] load .dockerignore
#4 transferring context: 2B done
#4 DONE 0.0s

#5 [stage-1 1/3] FROM docker.io/library/nginx:alpine@sha256:4870c12cd2ca986de501a804b4f506ad3875a0b1874940ba0a2c7f763f1855b2
#5 resolve docker.io/library/nginx:alpine@sha256:4870c12cd2ca986de501a804b4f506ad3875a0b1874940ba0a2c7f763f1855b2 0.0s done
#5 DONE 0.0s

#6 [build 1/6] FROM docker.io/library/node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8
#6 resolve docker.io/library/node:20-alpine@sha256:09e2b3d9726018aecf269bd35325f46bf75046a643a66d28360ec71132750ec8 0.0s done
#6 DONE 0.0s

#7 [internal] load build context
#7 transferring context: 103.50kB 0.1s done
#7 DONE 0.1s

#8 [build 2/6] WORKDIR /app
#8 CACHED

#9 [build 3/6] COPY package*.json ./
#9 CACHED

#10 [build 4/6] RUN npm install --legacy-peer-deps
#10 CACHED

#11 [build 5/6] COPY . .
#11 DONE 0.2s

#12 [build 6/6] RUN npx vite build
#12 0.816 vite v5.4.19 building for production...
#12 0.880 transforming...
#12 1.236 Browserslist: browsers data (caniuse-lite) is 8 months old. Please run:
#12 1.236   npx update-browserslist-db@latest
#12 1.236   Why you should do it regularly: https://github.com/browserslist/update-db#readme
#12 2.602 ✓ 44 modules transformed.
#12 2.604 x Build failed in 1.75s
#12 2.605 error during build:
#12 2.605 [vite:esbuild] Transform failed with 1 error:
#12 2.605 /app/src/hooks/useProductionRecords.tsx:15:7: ERROR: Unexpected "{"
#12 2.605 file: /app/src/hooks/useProductionRecords.tsx:15:7
#12 2.605 
#12 2.605 Unexpected "{"
#12 2.605 13 |  
#12 2.605 14 |    // --- BUSCAR DADOS (GET) ---import { useState, useEffect } from "react";
#12 2.605 15 |  import { toast } from "@/components/ui/use-toast";
#12 2.605    |         ^
#12 2.605 16 |  import { useAuth } from "@/hooks/useAuth";
#12 2.605 17 |  import type { ProductionRecord, ProductionFormData } from "@/types/production";
#12 2.605 
#12 2.605     at failureErrorWithLog (/app/node_modules/esbuild/lib/main.js:1472:15)
#12 2.605     at /app/node_modules/esbuild/lib/main.js:755:50
#12 2.605     at responseCallbacks.<computed> (/app/node_modules/esbuild/lib/main.js:622:9)
#12 2.605     at handleIncomingPacket (/app/node_modules/esbuild/lib/main.js:677:12)
#12 2.605     at Socket.readFromStdout (/app/node_modules/esbuild/lib/main.js:600:7)
#12 2.605     at Socket.emit (node:events:524:28)
#12 2.605     at addChunk (node:internal/streams/readable:561:12)
#12 2.605     at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
#12 2.605     at Readable.push (node:internal/streams/readable:392:5)
#12 2.605     at Pipe.onStreamRead (node:internal/stream_base_commons:191:23)
#12 ERROR: process "/bin/sh -c npx vite build" did not complete successfully: exit code: 1
------
 > [build 6/6] RUN npx vite build:
2.605     at failureErrorWithLog (/app/node_modules/esbuild/lib/main.js:1472:15)
2.605     at /app/node_modules/esbuild/lib/main.js:755:50
2.605     at responseCallbacks.<computed> (/app/node_modules/esbuild/lib/main.js:622:9)
2.605     at handleIncomingPacket (/app/node_modules/esbuild/lib/main.js:677:12)
2.605     at Socket.readFromStdout (/app/node_modules/esbuild/lib/main.js:600:7)
2.605     at Socket.emit (node:events:524:28)
2.605     at addChunk (node:internal/streams/readable:561:12)
2.605     at readableAddChunkPushByteMode (node:internal/streams/readable:512:3)
2.605     at Readable.push (node:internal/streams/readable:392:5)
2.605     at Pipe.onStreamRead (node:internal/stream_base_commons:191:23)
------

 1 warning found (use docker --debug to expand):
 - FromAsCasing: 'as' and 'FROM' keywords' casing do not match (line 2)
Dockerfile:8
--------------------
   6 |     COPY . .
   7 |     # Forçamos a build ignorando erros de tipagem remanescentes
   8 | >>> RUN npx vite build
   9 |     
  10 |     # Estágio 2: Runtime
--------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c npx vite build" did not complete successfully: exit code: 1
##########################################
### Error
### Tue, 03 Feb 2026 10:23:45 GMT
##########################################

Command failed with exit code 1: docker buildx build --network host -f /etc/easypanel/projects/industria-vo-jorge/app-fariheira/code/Dockerfile -t easypanel/industria-vo-jorge/app-fariheira --label 'keep=true' --build-arg 'VITE_API_URL=https://github.com/ricksfonseca-max/app-farinheira-vojorge' --build-arg 'GIT_SHA=18e2651699b5adf9a486177d56cd74867178a206' /etc/easypanel/projects/industria-vo-jorge/app-fariheira/code/

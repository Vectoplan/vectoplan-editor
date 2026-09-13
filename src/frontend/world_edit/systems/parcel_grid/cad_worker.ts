import { buildCadParcelGrid } from "./cad_adapter";
const worker = globalThis as unknown as { onmessage: (event: MessageEvent) => void; postMessage: (value: unknown) => void };
worker.onmessage = (event) => {
  try { worker.postMessage({id:event.data.id,result:buildCadParcelGrid(event.data.input)}); }
  catch(error) { worker.postMessage({id:event.data.id,error:error instanceof Error?error.message:String(error)}); }
};

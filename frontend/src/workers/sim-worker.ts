declare const self: DedicatedWorkerGlobalScope

interface PyodideInterface {
  loadPackage: (packages: string[]) => Promise<void>
  runPython: (code: string) => unknown
  globals: { get: (key: string) => unknown }
  FS: { writeFile: (path: string, data: string) => void; mkdir: (path: string) => void }
}

declare function loadPyodide(options?: { indexURL?: string }): Promise<PyodideInterface>

let pyodide: PyodideInterface | null = null
let engineLoaded = false

async function initPyodide(engineCode: string): Promise<void> {
  importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js')

  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/',
  })

  setupEngineFiles(engineCode)

  pyodide.runPython(`
import sys
sys.path.insert(0, '/engine')
from engine.worker_api import handle_message as _handle_message
import json

def handle_message_json(msg_json):
    msg = json.loads(msg_json)
    result = _handle_message(msg)
    return json.dumps(result)
`)

  engineLoaded = true
}

function setupEngineFiles(engineCode: string): void {
  if (!pyodide) return

  const files: Record<string, string> = JSON.parse(engineCode)

  const dirs = new Set<string>()
  for (const path of Object.keys(files)) {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'))
    }
  }
  for (const dir of Array.from(dirs).sort()) {
    try { pyodide.FS.mkdir(`/${dir}`) } catch { /* exists */ }
  }

  for (const [path, content] of Object.entries(files)) {
    pyodide.FS.writeFile(`/${path}`, content)
  }
}

function callEngine(request: { type: string; payload?: unknown }): unknown {
  if (!pyodide || !engineLoaded) {
    throw new Error('Engine not initialized')
  }

  const msgJson = JSON.stringify(request)
  const handleFn = pyodide.globals.get('handle_message_json') as (s: string) => string
  const resultJson = handleFn(msgJson)
  return JSON.parse(resultJson)
}

self.onmessage = async (event: MessageEvent) => {
  const { requestId, request } = event.data

  try {
    if (request.type === 'INIT') {
      self.postMessage({
        requestId,
        response: { type: 'PROGRESS', payload: { percent: 0, message: 'Loading Pyodide...' } },
      })

      await initPyodide(request.payload.engineCode)

      self.postMessage({
        requestId,
        response: { type: 'INIT_COMPLETE', success: true },
      })
      return
    }

    if (request.type === 'CANCEL') {
      return
    }

    const result = callEngine(request)
    self.postMessage({ requestId, response: result })
  } catch (err) {
    self.postMessage({
      requestId,
      response: {
        type: 'ERROR',
        payload: {
          code: 'WORKER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      },
    })
  }
}
